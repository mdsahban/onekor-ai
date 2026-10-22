import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { provider, apiKey, baseUrl, modelId, modelDbId } = body;
    if (!provider) return Response.json({ error: 'provider is required' }, { status: 400 });
    if (!apiKey) return Response.json({ error: 'apiKey is required' }, { status: 400 });

    let validated = false;
    let validationError = '';
    let capabilities = [];
    let modelInfo = null;

    try {
      if (provider === 'openai') {
        const url = (baseUrl || 'https://api.openai.com/v1') + '/models';
        const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`OpenAI API returned ${res.status}: ${err.substring(0, 200)}`);
        }
        const data = await res.json();
        const modelIds = (data.data || []).map((m) => m.id);
        validated = true;
        capabilities = ['text', 'function_calling', 'vision'];
        modelInfo = { available_models: modelIds.slice(0, 20) };
        if (modelId && !modelIds.includes(modelId)) {
          validationError = `Model "${modelId}" not found in available models.`;
          validated = false;
        }
      } else if (provider === 'anthropic') {
        const url = (baseUrl || 'https://api.anthropic.com/v1') + '/messages';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelId || 'claude-3-5-sonnet-20241022', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Anthropic API returned ${res.status}: ${err.substring(0, 200)}`);
        }
        validated = true;
        capabilities = ['text', 'vision', 'function_calling', 'reasoning'];
      } else if (provider === 'google') {
        const url = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta') + '/models?key=' + apiKey;
        const res = await fetch(url);
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Google AI API returned ${res.status}: ${err.substring(0, 200)}`);
        }
        validated = true;
        capabilities = ['text', 'vision'];
      } else if (provider === 'custom') {
        if (!baseUrl) throw new Error('baseUrl is required for custom providers');
        const url = baseUrl.replace(/\/$/, '') + '/models';
        const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Custom API returned ${res.status}: ${err.substring(0, 200)}`);
        }
        validated = true;
        capabilities = ['text'];
      }
    } catch (e) {
      validationError = e.message;
      validated = false;
    }

    // Update model in database if modelDbId provided
    if (modelDbId) {
      await base44.entities.AiModel.update(modelDbId, {
        is_validated: validated,
        validation_status: validated ? 'validated' : 'failed',
        validation_error: validationError,
        last_validated_at: new Date().toISOString(),
        capabilities,
        config: { _api_key: apiKey },
      });
    }

    await base44.entities.AuditEvent.create({
      action: 'ai_model_validated', resource_type: 'ai_model', resource_id: modelDbId || 'inline',
      result: validated ? 'success' : 'failure',
      details: { provider, model_id: modelId, validated, error: validationError || null },
    });

    return Response.json({ validated, validation_error: validationError, capabilities, model_info: modelInfo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}