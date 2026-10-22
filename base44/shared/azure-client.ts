// ─── Azure Discovery Client ───────────────────────────────────────────
// Covers: Azure OpenAI, Cognitive Services, ML Workspaces, AI Studio, Bot Services
// Auth: Service Principal (client_id + client_secret + tenant_id)
//
// Azure REST API references:
//   https://learn.microsoft.com/en-us/rest/api/azure/
//   https://learn.microsoft.com/en-us/azure/ai-services/
//   https://learn.microsoft.com/en-us/azure/machine-learning/

const AZURE_MANAGEMENT_API = 'https://management.azure.com';
const AZURE_TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

// ─── Token acquisition ────────────────────────────────────────────────

export interface AzureCredentials {
  tenantId: string;
  clientId: string;
  clientSecret?: string;
  subscriptionIds?: string[];
}

export interface AzureTokenResult {
  ok: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
  status?: string;
  latency?: number;
}

export async function getAzureAccessToken(creds: AzureCredentials): Promise<AzureTokenResult> {
  const t0 = Date.now();
  try {
    if (!creds.tenantId || !creds.clientId || !creds.clientSecret) {
      return { ok: false, status: 'not_configured', error: 'Azure credentials are incomplete. Tenant ID, Client ID, and Client Secret are all required.' };
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'https://management.azure.com/.default',
    });

    const res = await fetch(AZURE_TOKEN_URL(creds.tenantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json() as any;
    if (!res.ok) {
      const errCode = data.error;
      const errDesc = data.error_description || '';
      if (errCode === 'invalid_client' || errDesc.includes('password')) {
        return { ok: false, status: 'authentication_failed', error: `Azure authentication failed: Invalid client credentials. ${errDesc.split('.')[0]}.`, latency: Date.now() - t0 };
      }
      if (errCode === 'unauthorized_client') {
        return { ok: false, status: 'permission_denied', error: `Azure authentication failed: The service principal is not authorized. ${errDesc.split('.')[0]}.`, latency: Date.now() - t0 };
      }
      if (errDesc.includes('Tenant') || errCode === 'invalid_tenant') {
        return { ok: false, status: 'authentication_failed', error: `Azure authentication failed: Tenant ID not found or invalid.`, latency: Date.now() - t0 };
      }
      return { ok: false, status: 'error', error: `Azure token request failed (${errCode}): ${errDesc.split('.')[0]}.`, latency: Date.now() - t0 };
    }

    return {
      ok: true,
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      latency: Date.now() - t0,
    };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error connecting to Azure AD: ${e.message}`, latency: Date.now() - t0 };
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────

export async function listSubscriptions(token: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${AZURE_MANAGEMENT_API}/subscriptions?api-version=2022-12-01`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      return { ok: false, status: 'error', error: `Failed to list subscriptions (HTTP ${res.status}): ${body?.error?.message || 'Unknown error'}`, subscriptions: [], latency: Date.now() - t0 };
    }
    const data = await res.json() as any;
    const subs = (data.value || []).map((s: any) => ({
      id: s.subscriptionId,
      name: s.displayName,
      state: s.state,
      tenantId: s.tenantId,
    }));
    return { ok: true, subscriptions: subs, latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error listing Azure subscriptions: ${e.message}`, subscriptions: [], latency: Date.now() - t0 };
  }
}

// ─── Resource group discovery ─────────────────────────────────────────

async function listResourcesByType(token: string, subscriptionId: string, resourceType: string, apiVersion: string) {
  try {
    const url = `${AZURE_MANAGEMENT_API}/subscriptions/${subscriptionId}/resources?$filter=resourceType eq '${resourceType}'&api-version=2021-04-01`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return data.value || [];
  } catch {
    return [];
  }
}

async function getResourceDetails(token: string, resourceId: string, apiVersion: string) {
  try {
    const res = await fetch(`${AZURE_MANAGEMENT_API}${resourceId}?api-version=${apiVersion}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Azure OpenAI discovery ───────────────────────────────────────────

export interface AzureAIResource {
  id: string;
  name: string;
  type: string;
  location: string;
  resourceGroup: string;
  subscriptionId: string;
  assetType: string;
  provider: string;
  properties?: Record<string, any>;
  endpoint?: string;
  deployments?: any[];
  sku?: string;
  tags?: Record<string, string>;
}

export async function discoverAzureOpenAI(token: string, subscriptionId: string): Promise<{ resources: AzureAIResource[], errors: string[] }> {
  const resources: AzureAIResource[] = [];
  const errors: string[] = [];

  try {
    const accounts = await listResourcesByType(token, subscriptionId, 'Microsoft.CognitiveServices/accounts', '2023-05-01');
    for (const account of accounts) {
      // Only Azure OpenAI accounts
      if (account.kind !== 'OpenAI') continue;

      const details = await getResourceDetails(token, account.id, '2023-05-01') as any;
      const endpoint = details?.properties?.endpoint || '';

      // Discover model deployments
      let deployments: any[] = [];
      try {
        const deployRes = await fetch(`${AZURE_MANAGEMENT_API}${account.id}/deployments?api-version=2023-05-01`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        });
        if (deployRes.ok) {
          const deployData = await deployRes.json() as any;
          deployments = (deployData.value || []).map((d: any) => ({
            name: d.name,
            model: d.properties?.model?.name,
            modelVersion: d.properties?.model?.version,
            sku: d.sku?.name,
            capacity: d.sku?.capacity,
            status: d.properties?.provisioningState,
          }));
        }
      } catch { /* skip deployments on error */ }

      const rg = account.id.split('/resourceGroups/')[1]?.split('/')[0] || '';
      resources.push({
        id: account.id,
        name: account.name,
        type: 'Microsoft.CognitiveServices/accounts',
        location: account.location,
        resourceGroup: rg,
        subscriptionId,
        assetType: 'ai_model',
        provider: 'azure_openai',
        endpoint,
        deployments,
        sku: account.sku?.name,
        tags: account.tags || {},
        properties: {
          kind: account.kind,
          provisioningState: details?.properties?.provisioningState,
        },
      });
    }
  } catch (e: any) {
    errors.push(`Azure OpenAI discovery error: ${e.message}`);
  }

  return { resources, errors };
}

// ─── Azure Machine Learning workspaces ───────────────────────────────

export async function discoverAzureML(token: string, subscriptionId: string): Promise<{ resources: AzureAIResource[], errors: string[] }> {
  const resources: AzureAIResource[] = [];
  const errors: string[] = [];

  try {
    const workspaces = await listResourcesByType(token, subscriptionId, 'Microsoft.MachineLearningServices/workspaces', '2023-06-01-preview');
    for (const ws of workspaces) {
      const rg = ws.id.split('/resourceGroups/')[1]?.split('/')[0] || '';
      const details = await getResourceDetails(token, ws.id, '2023-06-01-preview') as any;

      resources.push({
        id: ws.id,
        name: ws.name,
        type: 'Microsoft.MachineLearningServices/workspaces',
        location: ws.location,
        resourceGroup: rg,
        subscriptionId,
        assetType: 'ai_platform',
        provider: 'azure_ml',
        sku: ws.sku?.name,
        tags: ws.tags || {},
        properties: {
          provisioningState: details?.properties?.provisioningState,
          workspaceId: details?.properties?.workspaceId,
          friendlyName: details?.properties?.friendlyName,
        },
      });
    }
  } catch (e: any) {
    errors.push(`Azure ML discovery error: ${e.message}`);
  }

  return { resources, errors };
}

// ─── Azure Cognitive Services ─────────────────────────────────────────

export async function discoverAzureCognitiveServices(token: string, subscriptionId: string): Promise<{ resources: AzureAIResource[], errors: string[] }> {
  const resources: AzureAIResource[] = [];
  const errors: string[] = [];

  // Known AI-relevant kinds (not OpenAI which is handled separately)
  const aiKinds = new Set(['TextAnalytics', 'ComputerVision', 'SpeechServices', 'ContentModerator',
    'FormRecognizer', 'LUIS', 'QnAMaker', 'Translator', 'AnomalyDetector', 'Personalizer',
    'ContentSafety', 'Language', 'OpenAI', 'CognitiveServices', 'TextTranslation']);

  try {
    const accounts = await listResourcesByType(token, subscriptionId, 'Microsoft.CognitiveServices/accounts', '2023-05-01');
    for (const account of accounts) {
      if (!aiKinds.has(account.kind) || account.kind === 'OpenAI') continue; // OpenAI handled separately
      const rg = account.id.split('/resourceGroups/')[1]?.split('/')[0] || '';
      const details = await getResourceDetails(token, account.id, '2023-05-01') as any;

      resources.push({
        id: account.id,
        name: account.name,
        type: 'Microsoft.CognitiveServices/accounts',
        location: account.location,
        resourceGroup: rg,
        subscriptionId,
        assetType: 'ai_service',
        provider: 'azure',
        endpoint: details?.properties?.endpoint || '',
        sku: account.sku?.name,
        tags: account.tags || {},
        properties: {
          kind: account.kind,
          provisioningState: details?.properties?.provisioningState,
        },
      });
    }
  } catch (e: any) {
    errors.push(`Azure Cognitive Services discovery error: ${e.message}`);
  }

  return { resources, errors };
}

// ─── Azure Bot Services ───────────────────────────────────────────────

export async function discoverAzureBotServices(token: string, subscriptionId: string): Promise<{ resources: AzureAIResource[], errors: string[] }> {
  const resources: AzureAIResource[] = [];
  const errors: string[] = [];

  try {
    const bots = await listResourcesByType(token, subscriptionId, 'Microsoft.BotService/botServices', '2022-09-15');
    for (const bot of bots) {
      const rg = bot.id.split('/resourceGroups/')[1]?.split('/')[0] || '';
      resources.push({
        id: bot.id,
        name: bot.name,
        type: 'Microsoft.BotService/botServices',
        location: bot.location,
        resourceGroup: rg,
        subscriptionId,
        assetType: 'ai_agent',
        provider: 'azure',
        sku: bot.sku?.name,
        tags: bot.tags || {},
        properties: { kind: bot.kind },
      });
    }
  } catch (e: any) {
    errors.push(`Azure Bot Services discovery error: ${e.message}`);
  }

  return { resources, errors };
}

// ─── Credential resolution ────────────────────────────────────────────

export function resolveAzureCredentials(source: any): AzureCredentials | null {
  const config = source.config || {};
  const tenantId = config._tenant_id || config.tenantId || config.tenant_id || '';
  const clientId = config._client_id || config.clientId || config.client_id || '';
  const clientSecret = config._client_secret || config.clientSecret || config.client_secret || '';
  const subscriptionIds = config.subscription_ids || config.subscriptionIds || [];

  if (!tenantId || !clientId) return null;
  return { tenantId, clientId, clientSecret, subscriptionIds };
}
