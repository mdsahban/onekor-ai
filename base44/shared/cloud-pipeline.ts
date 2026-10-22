// ─── Cloud Discovery Pipeline ─────────────────────────────────────────
// Lifecycle: Connect → Authenticate → Discover → Normalize → Deduplicate → Enrich → Upsert
//
// Supports: Azure (OpenAI, ML, Cognitive Services, Bot Services)
//           AWS   (Bedrock, SageMaker)
//           GCP   (Vertex AI, Dialogflow)

import {
  getAzureAccessToken, listSubscriptions,
  discoverAzureOpenAI, discoverAzureML, discoverAzureCognitiveServices, discoverAzureBotServices,
  resolveAzureCredentials,
} from './azure-client.ts';

import {
  getAWSCallerIdentity, listBedrockFoundationModels, listBedrockCustomModels,
  listSageMakerEndpoints, resolveAWSCredentials,
} from './aws-client.ts';

import {
  getGCPAccessToken, discoverVertexAIModels, discoverVertexAIEndpoints,
  discoverDialogflowAgents, resolveGCPCredentials,
} from './gcp-client.ts';

// ─── Normalizer ────────────────────────────────────────────────────────

function normalizeResource(resource: any, sourceId: string, runId: string): {
  externalId: string;
  name: string;
  displayName: string;
  assetType: string;
  provider: string;
  description: string;
  enrichedData: Record<string, any>;
} {
  const externalId = `${resource.provider}:${resource.id || resource.name}`;
  return {
    externalId,
    name: resource.name,
    displayName: resource.name,
    assetType: resource.assetType || 'ai_service',
    provider: resource.provider || 'cloud',
    description: buildResourceDescription(resource),
    enrichedData: {
      type: resource.type,
      region: resource.region || resource.location,
      projectId: resource.projectId,
      subscriptionId: resource.subscriptionId,
      resourceGroup: resource.resourceGroup,
      endpoint: resource.endpoint,
      sku: resource.sku,
      tags: resource.tags,
      deployments: resource.deployments,
      properties: resource.properties,
    },
  };
}

function buildResourceDescription(resource: any): string {
  const parts: string[] = [];
  if (resource.type) parts.push(resource.type);
  if (resource.region || resource.location) parts.push(`in ${resource.region || resource.location}`);
  if (resource.sku) parts.push(`(${resource.sku})`);
  return parts.join(' ') || resource.assetType || 'Cloud AI resource';
}

// ─── Upsert helper ────────────────────────────────────────────────────

async function upsertAiAsset(base44: any, normalized: ReturnType<typeof normalizeResource>, sourceId: string, runId: string): Promise<{ created: boolean, assetId: string }> {
  const now = new Date().toISOString();

  const linkPage = await base44.entities.AiAssetSource.filter({ external_id: normalized.externalId }, { limit: 1 });
  const existingLink = linkPage.items && linkPage.items[0];

  if (existingLink) {
    await base44.entities.AiAsset.update(existingLink.asset_id, {
      name: normalized.name,
      display_name: normalized.displayName,
      asset_type: normalized.assetType,
      provider: normalized.provider,
      last_seen: now,
      status: 'active',
      enriched_data: normalized.enrichedData,
    });
    await base44.entities.AiAssetSource.update(existingLink.id, { last_seen: now });
    return { created: false, assetId: existingLink.asset_id };
  }

  const asset = await base44.entities.AiAsset.create({
    name: normalized.name,
    display_name: normalized.displayName,
    asset_type: normalized.assetType,
    provider: normalized.provider,
    description: normalized.description,
    confidence_score: 0.95,
    first_seen: now,
    last_seen: now,
    status: 'active',
    enriched_data: normalized.enrichedData,
  });

  await base44.entities.AiAssetSource.create({
    asset_id: asset.id,
    source_id: sourceId,
    external_id: normalized.externalId,
    first_seen: now,
    last_seen: now,
  });

  // Create a discovery finding for evidence
  await base44.entities.DiscoveryFinding.create({
    source_id: sourceId,
    run_id: runId,
    external_id: normalized.externalId,
    name: normalized.name,
    provider: normalized.provider,
    asset_type: normalized.assetType,
    asset_id: asset.id,
    confidence_score: 0.95,
    confidence_level: 'high',
    confidence_reasons: [`Directly enumerated from ${normalized.provider} API`],
    evidence: normalized.enrichedData,
    status: 'asset_created',
  });

  return { created: true, assetId: asset.id };
}

// ─── Azure pipeline ───────────────────────────────────────────────────

export async function runAzurePipeline(base44: any, source: any, runId: string) {
  const logs: any[] = [];
  const addLog = (severity: string, stage: string, message: string, duration_ms?: number) =>
    logs.push({ run_id: runId, source_id: source.id, severity, stage, message, ...(duration_ms ? { duration_ms } : {}) });

  let assetsCreated = 0;
  let assetsUpdated = 0;
  let resourcesDiscovered = 0;
  let duplicatesDetected = 0;
  const errors: string[] = [];

  // CONNECT
  addLog('info', 'connect', 'Connecting to Microsoft Azure...');
  const creds = resolveAzureCredentials(source);
  if (!creds) {
    addLog('error', 'connect', 'Azure credentials not configured. Tenant ID, Client ID, and Client Secret are required.');
    return { logs, failed: true, error: 'Azure credentials not configured.', assetsCreated, assetsUpdated, resourcesDiscovered, duplicatesDetected };
  }

  const t0 = Date.now();
  const tokenResult = await getAzureAccessToken(creds);
  if (!tokenResult.ok) {
    addLog('error', 'authenticate', tokenResult.error || 'Azure authentication failed.', Date.now() - t0);
    return { logs, failed: true, error: tokenResult.error, assetsCreated, assetsUpdated, resourcesDiscovered, duplicatesDetected };
  }
  addLog('info', 'authenticate', 'Azure service principal authenticated successfully.', tokenResult.latency);

  const token = tokenResult.token!;

  // FETCH subscriptions
  const subResult = await listSubscriptions(token);
  let subscriptions: any[];
  if (!subResult.ok) {
    addLog('warn', 'fetch', `Failed to list subscriptions: ${subResult.error}. Using configured subscription IDs.`);
    subscriptions = (creds.subscriptionIds || []).map(id => ({ id, name: id }));
  } else {
    const configuredIds = creds.subscriptionIds || [];
    subscriptions = configuredIds.length > 0
      ? subResult.subscriptions.filter(s => configuredIds.includes(s.id))
      : subResult.subscriptions;
    addLog('info', 'fetch', `Found ${subscriptions.length} subscription(s) to scan.`, subResult.latency);
  }

  if (subscriptions.length === 0) {
    addLog('warn', 'fetch', 'No subscriptions found to scan. Ensure the service principal has Reader role on at least one subscription.');
  }

  // DISCOVER across subscriptions
  for (const sub of subscriptions.slice(0, 10)) {
    addLog('info', 'fetch', `Scanning subscription: ${sub.name || sub.id}`);

    const [aoaiResult, mlResult, cogResult, botResult] = await Promise.allSettled([
      discoverAzureOpenAI(token, sub.id),
      discoverAzureML(token, sub.id),
      discoverAzureCognitiveServices(token, sub.id),
      discoverAzureBotServices(token, sub.id),
    ]);

    const allResources: any[] = [];
    for (const result of [aoaiResult, mlResult, cogResult, botResult]) {
      if (result.status === 'fulfilled') {
        allResources.push(...result.value.resources);
        for (const err of result.value.errors) {
          addLog('warn', 'fetch', err);
          errors.push(err);
        }
      }
    }

    addLog('info', 'fetch', `Found ${allResources.length} AI resource(s) in ${sub.name || sub.id}.`);
    resourcesDiscovered += allResources.length;

    // NORMALIZE + DEDUPLICATE + UPSERT
    for (const resource of allResources) {
      const normalized = normalizeResource(resource, source.id, runId);
      try {
        const { created } = await upsertAiAsset(base44, normalized, source.id, runId);
        if (created) {
          assetsCreated++;
          addLog('info', 'upsert', `Created AI asset: ${resource.name} (${resource.type})`);
        } else {
          assetsUpdated++;
          duplicatesDetected++;
          addLog('info', 'deduplicate', `Updated existing AI asset: ${resource.name}`);
        }
      } catch (e: any) {
        addLog('error', 'upsert', `Failed to upsert asset ${resource.name}: ${e.message}`);
        errors.push(e.message);
      }
    }
  }

  addLog('info', 'complete', `Azure discovery completed. ${resourcesDiscovered} resources found, ${assetsCreated} assets created, ${assetsUpdated} updated.`);

  return {
    logs,
    failed: false,
    assetsCreated,
    assetsUpdated,
    resourcesDiscovered,
    duplicatesDetected,
    errors,
  };
}

// ─── AWS pipeline ─────────────────────────────────────────────────────

export async function runAWSPipeline(base44: any, source: any, runId: string) {
  const logs: any[] = [];
  const addLog = (severity: string, stage: string, message: string, duration_ms?: number) =>
    logs.push({ run_id: runId, source_id: source.id, severity, stage, message, ...(duration_ms ? { duration_ms } : {}) });

  let assetsCreated = 0;
  let assetsUpdated = 0;
  let resourcesDiscovered = 0;
  let duplicatesDetected = 0;

  // CONNECT
  addLog('info', 'connect', 'Connecting to AWS...');
  const creds = resolveAWSCredentials(source);
  if (!creds) {
    addLog('error', 'connect', 'AWS credentials not configured. Access Key ID and Secret Access Key are required.');
    return { logs, failed: true, error: 'AWS credentials not configured.', assetsCreated, assetsUpdated, resourcesDiscovered, duplicatesDetected };
  }

  const identityResult = await getAWSCallerIdentity(creds);
  if (!identityResult.ok) {
    addLog('error', 'authenticate', identityResult.error || 'AWS authentication failed.', identityResult.latency);
    return { logs, failed: true, error: identityResult.error, assetsCreated, assetsUpdated, resourcesDiscovered, duplicatesDetected };
  }
  addLog('info', 'authenticate', `AWS authenticated. Account: ${identityResult.accountId}, ARN: ${identityResult.arn}`, identityResult.latency);

  const config = source.config || {};
  const regions: string[] = config.regions || [creds.region];

  // DISCOVER Bedrock
  for (const region of regions.slice(0, 5)) {
    const regionCreds = { ...creds, region };

    // Bedrock foundation models
    addLog('info', 'fetch', `Discovering AWS Bedrock foundation models in ${region}...`);
    const bedrockResult = await listBedrockFoundationModels(regionCreds);
    if (!bedrockResult.ok) {
      addLog('warn', 'fetch', `Bedrock in ${region}: ${bedrockResult.error}`);
    } else {
      addLog('info', 'fetch', `Found ${bedrockResult.models.length} Bedrock foundation model(s) in ${region}.`, bedrockResult.latency);
      resourcesDiscovered += bedrockResult.models.length;

      for (const model of bedrockResult.models) {
        const resource = {
          id: `${region}/${model.modelId}`,
          name: model.modelName,
          type: 'aws_bedrock_model',
          region,
          assetType: 'ai_model',
          provider: 'aws_bedrock',
          properties: {
            modelId: model.modelId,
            providerName: model.providerName,
            inputModalities: model.inputModalities,
            outputModalities: model.outputModalities,
            inferenceTypesSupported: model.inferenceTypesSupported,
          },
        };
        const normalized = normalizeResource(resource, source.id, runId);
        try {
          const { created } = await upsertAiAsset(base44, normalized, source.id, runId);
          if (created) { assetsCreated++; } else { assetsUpdated++; duplicatesDetected++; }
        } catch (e: any) {
          addLog('error', 'upsert', `Failed to upsert ${model.modelName}: ${e.message}`);
        }
      }
    }

    // SageMaker endpoints
    addLog('info', 'fetch', `Discovering SageMaker endpoints in ${region}...`);
    const sagemakerResult = await listSageMakerEndpoints(regionCreds);
    if (!sagemakerResult.ok) {
      addLog('warn', 'fetch', `SageMaker in ${region}: ${sagemakerResult.error}`);
    } else {
      addLog('info', 'fetch', `Found ${sagemakerResult.endpoints.length} SageMaker endpoint(s) in ${region}.`, sagemakerResult.latency);
      resourcesDiscovered += sagemakerResult.endpoints.length;

      for (const ep of sagemakerResult.endpoints) {
        const resource = {
          id: `${region}/${ep.EndpointName}`,
          name: ep.EndpointName,
          type: 'aws_sagemaker_endpoint',
          region,
          assetType: 'ai_endpoint',
          provider: 'aws_sagemaker',
          properties: {
            endpointArn: ep.EndpointArn,
            status: ep.EndpointStatus,
            creationTime: ep.CreationTime,
            lastModifiedTime: ep.LastModifiedTime,
          },
        };
        const normalized = normalizeResource(resource, source.id, runId);
        try {
          const { created } = await upsertAiAsset(base44, normalized, source.id, runId);
          if (created) { assetsCreated++; } else { assetsUpdated++; duplicatesDetected++; }
        } catch (e: any) {
          addLog('error', 'upsert', `Failed to upsert ${ep.EndpointName}: ${e.message}`);
        }
      }
    }
  }

  addLog('info', 'complete', `AWS discovery completed. ${resourcesDiscovered} resources found, ${assetsCreated} assets created, ${assetsUpdated} updated.`);

  return {
    logs,
    failed: false,
    assetsCreated,
    assetsUpdated,
    resourcesDiscovered,
    duplicatesDetected,
  };
}

// ─── GCP pipeline ─────────────────────────────────────────────────────

export async function runGCPPipeline(base44: any, source: any, runId: string) {
  const logs: any[] = [];
  const addLog = (severity: string, stage: string, message: string, duration_ms?: number) =>
    logs.push({ run_id: runId, source_id: source.id, severity, stage, message, ...(duration_ms ? { duration_ms } : {}) });

  let assetsCreated = 0;
  let assetsUpdated = 0;
  let resourcesDiscovered = 0;
  let duplicatesDetected = 0;

  // CONNECT
  addLog('info', 'connect', 'Connecting to Google Cloud...');
  const creds = resolveGCPCredentials(source);
  if (!creds) {
    addLog('error', 'connect', 'GCP credentials not configured. Service account JSON is required.');
    return { logs, failed: true, error: 'GCP credentials not configured.', assetsCreated, assetsUpdated, resourcesDiscovered, duplicatesDetected };
  }

  const tokenResult = await getGCPAccessToken(creds);
  if (!tokenResult.ok) {
    addLog('error', 'authenticate', tokenResult.error || 'GCP authentication failed.', tokenResult.latency);
    return { logs, failed: true, error: tokenResult.error, assetsCreated, assetsUpdated, resourcesDiscovered, duplicatesDetected };
  }
  addLog('info', 'authenticate', `GCP authenticated as ${creds.clientEmail}`, tokenResult.latency);

  const token = tokenResult.token!;
  const config = source.config || {};
  const projects = creds.additionalProjects && creds.additionalProjects.length > 0
    ? [creds.projectId, ...creds.additionalProjects]
    : [creds.projectId];
  const regions: string[] = config.regions || [];

  for (const projectId of projects.slice(0, 5)) {
    addLog('info', 'fetch', `Scanning GCP project: ${projectId}`);

    // Discover Vertex AI models, endpoints, Dialogflow agents
    const [modelsResult, endpointsResult, dialogflowResult] = await Promise.allSettled([
      discoverVertexAIModels(token, projectId, regions),
      discoverVertexAIEndpoints(token, projectId, regions),
      discoverDialogflowAgents(token, projectId, regions),
    ]);

    const allResources: any[] = [];
    for (const result of [modelsResult, endpointsResult, dialogflowResult]) {
      if (result.status === 'fulfilled') {
        allResources.push(...result.value.resources);
        for (const err of result.value.errors) {
          addLog('warn', 'fetch', err);
        }
      }
    }

    addLog('info', 'fetch', `Found ${allResources.length} AI resource(s) in project ${projectId}.`);
    resourcesDiscovered += allResources.length;

    for (const resource of allResources) {
      const normalized = normalizeResource(resource, source.id, runId);
      try {
        const { created } = await upsertAiAsset(base44, normalized, source.id, runId);
        if (created) {
          assetsCreated++;
          addLog('info', 'upsert', `Created AI asset: ${resource.name} (${resource.type})`);
        } else {
          assetsUpdated++;
          duplicatesDetected++;
          addLog('info', 'deduplicate', `Updated existing AI asset: ${resource.name}`);
        }
      } catch (e: any) {
        addLog('error', 'upsert', `Failed to upsert ${resource.name}: ${e.message}`);
      }
    }
  }

  addLog('info', 'complete', `GCP discovery completed. ${resourcesDiscovered} resources found, ${assetsCreated} assets created, ${assetsUpdated} updated.`);

  return {
    logs,
    failed: false,
    assetsCreated,
    assetsUpdated,
    resourcesDiscovered,
    duplicatesDetected,
  };
}
