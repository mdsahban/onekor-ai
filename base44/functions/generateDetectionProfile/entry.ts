import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { description } = body;
    if (!description) return Response.json({ error: 'description is required' }, { status: 400 });

    const prompt = `You are an AI detection expert for the OneKor AI governance platform. Convert the following plain-English detection requirement into a structured detection profile configuration.

Detection requirement:
"${description}"

Generate a JSON object with these fields:
- name: concise professional name
- description: clear description of what this detects
- detection_objective: what specifically to look for
- detection_instructions: English instructions for the AI detection engine
- category: one of: api_key, ai_model, ai_agent, ai_framework, ai_sdk, ai_api_endpoint, mcp, prompt, ai_config, ai_service, ai_application, shadow_ai, sensitive_ai, ai_workflow, ai_dependency, custom
- detection_methods: array from: package, import, config, file_path, api_endpoint, model_identifier, framework, ai_analysis, metadata_analysis, dependency_analysis
- detection_rules: array of deterministic rules, each with: pattern (string to match in code/config), type (package, import, config, file_path, api_endpoint, model_identifier, framework), asset_type (ai_application, ai_agent, ai_model, ai_api, ai_saas, ai_copilot, ai_workflow, ai_platform, ai_integration, ai_account, personal_ai_account, shadow_ai), provider (openai, anthropic, google, huggingface, github, unknown), confidence (high, medium, low), label (human-readable name)
- ai_prompt: an AI prompt for analyzing ambiguous signals, or empty string
- asset_type: default asset type to assign
- provider: default provider
- severity: high, medium, or low
- confidence_threshold: number 0-1 (default 0.5)

Generate 3-10 realistic detection rules with actual package names, import strings, or patterns that would match real AI technologies. Return ONLY the JSON object.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          detection_objective: { type: 'string' },
          detection_instructions: { type: 'string' },
          category: { type: 'string' },
          detection_methods: { type: 'array', items: { type: 'string' } },
          detection_rules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pattern: { type: 'string' },
                type: { type: 'string' },
                asset_type: { type: 'string' },
                provider: { type: 'string' },
                confidence: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
          ai_prompt: { type: 'string' },
          asset_type: { type: 'string' },
          provider: { type: 'string' },
          severity: { type: 'string' },
          confidence_threshold: { type: 'number' },
        },
      },
    });

    return Response.json({ profile: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}