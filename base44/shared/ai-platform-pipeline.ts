import {
  listModels as listOpenAIModels,
  resolveCredentials as resolveOpenAICredentials,
} from './openai-client.ts';
import {
  listModels as listAnthropicModels,
  resolveCredentials as resolveAnthropicCredentials,
} from './anthropic-client.ts';

// ─── AI Platform Discovery Pipeline ───
// Connection → Validate Credentials → Discover Account/Organization →
// Discover Available Resources → Collect Metadata → Normalize →
// Deduplicate → Enrich → Store as AI Source → Feed into AI Inventory

export async function runAiPlatformPipeline(base44: any, source: any, runId: string) {
  const connectorId = source.connector_id;
  const logs: any[] = [];
  let modelsDiscovered = 0;
  let assetsCreated = 0;
  let assetsUpdated = 0;
  let duplicatesDetected = 0;
  let organizations: string[] = [];

  // Stage: CONNECT — resolve and validate credentials
  logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'connect', message: `Connecting to ${connectorId}...` });

  let credentials: any;
  let modelsResult: any;

  if (connectorId === 'openai') {
    credentials = await resolveOpenAICredentials(source);
    if (!credentials.ok) {
      logs.push({ run_id: runId, source_id: source.id, severity: 'error', stage: 'connect', message: credentials.error });
      return { logs, failed: true, error: credentials.error, modelsDiscovered, assetsCreated, assetsUpdated, duplicatesDetected, organizations };
    }
    modelsResult = await listOpenAIModels(credentials.apiKey, credentials.organization, credentials.project);
  } else if (connectorId === 'anthropic') {
    credentials = await resolveAnthropicCredentials(source);
    if (!credentials.ok) {
      logs.push({ run_id: runId, source_id: source.id, severity: 'error', stage: 'connect', message: credentials.error });
      return { logs, failed: true, error: credentials.error, modelsDiscovered, assetsCreated, assetsUpdated, duplicatesDetected, organizations };
    }
    modelsResult = await listAnthropicModels(credentials.apiKey);
  } else {
    return { logs, failed: true, error: `Unsupported AI platform connector: ${connectorId}`, modelsDiscovered, assetsCreated, assetsUpdated, duplicatesDetected, organizations };
  }

  if (!modelsResult.ok) {
    logs.push({ run_id: runId, source_id: source.id, severity: 'error', stage: 'connect', message: modelsResult.error });
    return { logs, failed: true, error: modelsResult.error, modelsDiscovered, assetsCreated, assetsUpdated, duplicatesDetected, organizations };
  }

  logs.push({
    run_id: runId, source_id: source.id, severity: 'info', stage: 'authenticate',
    message: `Credentials validated successfully.`, duration_ms: modelsResult.latency,
  });

  // Stage: FETCH — discover available resources (models)
  const models = modelsResult.models || [];
  modelsDiscovered = models.length;
  organizations = modelsResult.organizations || [];

  logs.push({
    run_id: runId, source_id: source.id, severity: 'info', stage: 'fetch',
    message: `Discovered ${models.length} model(s)${organizations.length > 0 ? ` from ${organizations.length} organization(s): ${organizations.join(', ')}` : ''}.`,
    duration_ms: modelsResult.latency,
  });

  // Stage: NORMALIZE — standardize model metadata
  logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'normalize', message: `Normalizing ${models.length} model record(s)...` });

  const provider = connectorId === 'openai' ? 'openai' : 'anthropic';

  // Stage: DEDUPLICATE + ENRICH + UPSERT — create/update AI assets
  for (const model of models) {
    const externalId = `${connectorId}:${model.id}`;

    // Check for existing asset link (deduplication)
    const linkPage = await base44.entities.AiAssetSource.filter({ external_id: externalId }, { limit: 1 });
    const existingLink = linkPage.items && linkPage.items[0];

    const now = new Date().toISOString();
    const assetData: any = {
      name: model.id,
      display_name: model.display_name || model.id,
      asset_type: 'ai_model',
      provider,
      confidence_score: 1.0,
      first_seen: existingLink ? undefined : now,
      last_seen: now,
      status: 'active',
      enriched_data: {
        model_id: model.id,
        display_name: model.display_name,
        created: model.created || model.created_at,
        owned_by: model.owned_by,
        capabilities: model.capabilities,
        lifecycle: model.lifecycle,
        max_input_tokens: model.max_input_tokens,
        max_tokens: model.max_tokens,
        shutdown_date: model.shutdown_date,
        environment: connectorId,
      },
    };

    if (existingLink) {
      // Update existing asset
      const updateData = { ...assetData };
      delete updateData.first_seen;
      await base44.entities.AiAsset.update(existingLink.asset_id, updateData);
      await base44.entities.AiAssetSource.update(existingLink.id, { last_seen: now });
      assetsUpdated++;
      duplicatesDetected++;
      logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'deduplicate', message: `Updated existing model: ${model.id}` });
    } else {
      // Create new asset
      const asset = await base44.entities.AiAsset.create(assetData);
      await base44.entities.AiAssetSource.create({
        asset_id: asset.id,
        source_id: source.id,
        external_id: externalId,
        first_seen: now,
        last_seen: now,
      });
      assetsCreated++;
      logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'upsert', message: `Created AI asset for model: ${model.id}` });
    }
  }

  logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'upsert', message: 'Discovery pipeline completed.' });

  return {
    logs,
    failed: false,
    modelsDiscovered,
    assetsCreated,
    assetsUpdated,
    duplicatesDetected,
    organizations,
  };
}