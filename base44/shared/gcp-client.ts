// ─── Google Cloud Discovery Client ───────────────────────────────────
// Covers: Vertex AI, Gemini API, Dialogflow, CCAI, AutoML, AI Platform
// Auth: Service Account (JSON key with private key)
//
// GCP REST API references:
//   https://cloud.google.com/vertex-ai/docs/reference/rest
//   https://cloud.google.com/dialogflow/es/docs/reference/rest
//   https://cloud.google.com/ai-platform/docs/reference/rest

const GCP_AUTH_URL = 'https://oauth2.googleapis.com/token';
const GCP_IAM_URL = 'https://iam.googleapis.com';

// ─── JWT / Token for Service Account ─────────────────────────────────

export interface GCPCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  additionalProjects?: string[];
}

export interface GCPTokenResult {
  ok: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
  status?: string;
  latency?: number;
}

function base64UrlEncode(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN[^-]*-----/g, '')
    .replace(/-----END[^-]*-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Check if PKCS8 or PKCS1
  const isPkcs1 = pem.includes('BEGIN RSA PRIVATE KEY');
  let keyBuffer: ArrayBuffer;
  if (isPkcs1) {
    // Convert PKCS1 to PKCS8
    const oid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
    const algId = (() => {
      const len = (n: number) => n < 0x80 ? new Uint8Array([n]) : n < 0x100 ? new Uint8Array([0x81, n]) : new Uint8Array([0x82, (n >> 8) & 0xff, n & 0xff]);
      const wrap = (tag: number, data: Uint8Array) => { const l = len(data.length); const r = new Uint8Array(1 + l.length + data.length); r[0] = tag; r.set(l, 1); r.set(data, 1 + l.length); return r; };
      return wrap(0x30, new Uint8Array([...oid]));
    })();
    const octet = (() => {
      const len = (n: number) => n < 0x80 ? new Uint8Array([n]) : n < 0x100 ? new Uint8Array([0x81, n]) : new Uint8Array([0x82, (n >> 8) & 0xff, n & 0xff]);
      const l = len(bytes.length);
      const r = new Uint8Array(1 + l.length + bytes.length);
      r[0] = 0x04; r.set(l, 1); r.set(bytes, 1 + l.length);
      return r;
    })();
    const versionByte = new Uint8Array([0x02, 0x01, 0x00]);
    const seqContent = new Uint8Array([...versionByte, ...algId, ...octet]);
    const len = (n: number) => n < 0x80 ? new Uint8Array([n]) : n < 0x100 ? new Uint8Array([0x81, n]) : new Uint8Array([0x82, (n >> 8) & 0xff, n & 0xff]);
    const l = len(seqContent.length);
    const pkcs8 = new Uint8Array(1 + l.length + seqContent.length);
    pkcs8[0] = 0x30; pkcs8.set(l, 1); pkcs8.set(seqContent, 1 + l.length);
    keyBuffer = pkcs8.buffer;
  } else {
    keyBuffer = bytes.buffer;
  }

  return crypto.subtle.importKey('pkcs8', keyBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function createGCPJWT(creds: GCPCredentials): Promise<string> {
  const key = await importRsaPrivateKey(creds.privateKey);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.clientEmail,
    sub: creds.clientEmail,
    aud: GCP_AUTH_URL,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  const enc = (obj: any) => base64UrlEncode(JSON.stringify(obj));
  const sigInput = `${enc(header)}.${enc(claim)}`;
  const sigBuf = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(sigInput));
  const sigBytes = new Uint8Array(sigBuf);
  return `${sigInput}.${base64UrlEncode(sigBytes)}`;
}

export async function getGCPAccessToken(creds: GCPCredentials): Promise<GCPTokenResult> {
  const t0 = Date.now();
  try {
    if (!creds.clientEmail || !creds.privateKey) {
      return { ok: false, status: 'not_configured', error: 'GCP credentials are incomplete. Service account email and private key are required.' };
    }

    const jwt = await createGCPJWT(creds);
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    });

    const res = await fetch(GCP_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json() as any;
    if (!res.ok) {
      const err = data.error_description || data.error || '';
      if (err.includes('invalid_grant') || err.includes('Invalid JWT')) {
        return { ok: false, status: 'authentication_failed', error: `GCP authentication failed: ${err}. Check your service account key JSON.`, latency: Date.now() - t0 };
      }
      return { ok: false, status: 'error', error: `GCP token request failed: ${err}`, latency: Date.now() - t0 };
    }

    return {
      ok: true,
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      latency: Date.now() - t0,
    };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error authenticating with GCP: ${e.message}`, latency: Date.now() - t0 };
  }
}

// ─── GCP REST helper ──────────────────────────────────────────────────

async function gcpFetch(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  return res;
}

// ─── Vertex AI — model discovery ──────────────────────────────────────

export interface GCPAIResource {
  id: string;
  name: string;
  type: string;
  projectId: string;
  region?: string;
  assetType: string;
  provider: string;
  properties?: Record<string, any>;
}

export async function discoverVertexAIModels(token: string, projectId: string, regions: string[]): Promise<{ resources: GCPAIResource[], errors: string[] }> {
  const resources: GCPAIResource[] = [];
  const errors: string[] = [];

  const targetRegions = regions.length > 0 ? regions : ['us-central1', 'us-east1', 'europe-west4'];

  for (const region of targetRegions) {
    try {
      const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/models`;
      const res = await gcpFetch(token, url);
      if (!res.ok) {
        if (res.status === 403) {
          errors.push(`Vertex AI models: Permission denied in ${region}. Ensure service account has roles/aiplatform.viewer.`);
          continue;
        }
        if (res.status === 404) continue; // Region may not have resources
        errors.push(`Vertex AI models in ${region}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json() as any;
      for (const model of (data.models || [])) {
        const shortId = model.name.split('/').pop() || model.name;
        resources.push({
          id: model.name,
          name: model.displayName || shortId,
          type: 'vertex_ai_model',
          projectId,
          region,
          assetType: 'ai_model',
          provider: 'google_cloud',
          properties: {
            versionId: model.versionId,
            createTime: model.createTime,
            updateTime: model.updateTime,
            supportedDeploymentResourcesTypes: model.supportedDeploymentResourcesTypes,
            labels: model.labels,
            metadata: model.metadata,
          },
        });
      }
    } catch (e: any) {
      errors.push(`Vertex AI models in ${region}: ${e.message}`);
    }
  }

  return { resources, errors };
}

// ─── Vertex AI — endpoint discovery ───────────────────────────────────

export async function discoverVertexAIEndpoints(token: string, projectId: string, regions: string[]): Promise<{ resources: GCPAIResource[], errors: string[] }> {
  const resources: GCPAIResource[] = [];
  const errors: string[] = [];
  const targetRegions = regions.length > 0 ? regions : ['us-central1', 'us-east1', 'europe-west4'];

  for (const region of targetRegions) {
    try {
      const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints`;
      const res = await gcpFetch(token, url);
      if (!res.ok) {
        if (res.status === 403) {
          errors.push(`Vertex AI endpoints in ${region}: Permission denied.`);
          continue;
        }
        if (res.status === 404) continue;
        continue;
      }
      const data = await res.json() as any;
      for (const ep of (data.endpoints || [])) {
        const shortId = ep.name.split('/').pop() || ep.name;
        resources.push({
          id: ep.name,
          name: ep.displayName || shortId,
          type: 'vertex_ai_endpoint',
          projectId,
          region,
          assetType: 'ai_endpoint',
          provider: 'google_cloud',
          properties: {
            deployedModels: (ep.deployedModels || []).map((m: any) => ({ modelId: m.model, displayName: m.displayName })),
            createTime: ep.createTime,
            updateTime: ep.updateTime,
            labels: ep.labels,
          },
        });
      }
    } catch (e: any) {
      errors.push(`Vertex AI endpoints in ${region}: ${e.message}`);
    }
  }

  return { resources, errors };
}

// ─── Dialogflow CX — agent discovery ─────────────────────────────────

export async function discoverDialogflowAgents(token: string, projectId: string, regions: string[]): Promise<{ resources: GCPAIResource[], errors: string[] }> {
  const resources: GCPAIResource[] = [];
  const errors: string[] = [];
  const targetRegions = regions.length > 0 ? regions : ['us-central1', 'global'];

  for (const region of targetRegions) {
    try {
      const host = region === 'global' ? 'dialogflow.googleapis.com' : `${region}-dialogflow.googleapis.com`;
      const url = `https://${host}/v3/projects/${projectId}/locations/${region}/agents`;
      const res = await gcpFetch(token, url);
      if (!res.ok) {
        if (res.status === 403) {
          errors.push(`Dialogflow agents in ${region}: Permission denied.`);
          continue;
        }
        if (res.status === 404) continue;
        continue;
      }
      const data = await res.json() as any;
      for (const agent of (data.agents || [])) {
        const shortId = agent.name.split('/').pop() || agent.name;
        resources.push({
          id: agent.name,
          name: agent.displayName || shortId,
          type: 'dialogflow_agent',
          projectId,
          region,
          assetType: 'ai_agent',
          provider: 'google_cloud',
          properties: {
            defaultLanguageCode: agent.defaultLanguageCode,
            description: agent.description,
            avatarUri: agent.avatarUri,
            timeZone: agent.timeZone,
          },
        });
      }
    } catch (e: any) {
      errors.push(`Dialogflow agents in ${region}: ${e.message}`);
    }
  }

  return { resources, errors };
}

// ─── GCP available regions fetch ─────────────────────────────────────

export async function listVertexAIRegions(token: string, projectId: string): Promise<string[]> {
  // Known Vertex AI regions — listed statically to avoid extra API call
  return ['us-central1', 'us-east1', 'us-east4', 'us-west1', 'us-west4',
    'northamerica-northeast1', 'europe-west1', 'europe-west2', 'europe-west3',
    'europe-west4', 'europe-west6', 'asia-east1', 'asia-east2', 'asia-northeast1',
    'asia-northeast3', 'asia-south1', 'asia-southeast1', 'australia-southeast1'];
}

// ─── Credential resolution ────────────────────────────────────────────

export function resolveGCPCredentials(source: any): GCPCredentials | null {
  const config = source.config || {};

  // Support JSON key upload (stringified) or individual fields
  if (config._service_account_json || config.serviceAccountJson) {
    try {
      const json = JSON.parse(config._service_account_json || config.serviceAccountJson);
      return {
        projectId: config.project_id || config.projectId || json.project_id || '',
        clientEmail: json.client_email || '',
        privateKey: json.private_key || '',
        additionalProjects: config.additional_projects || [],
      };
    } catch { /* fall through to field-based */ }
  }

  const projectId = config.project_id || config.projectId || '';
  const clientEmail = config._client_email || config.clientEmail || config.client_email || '';
  const privateKey = config._private_key || config.privateKey || config.private_key || '';

  if (!projectId || !clientEmail || !privateKey) return null;
  return {
    projectId,
    clientEmail,
    privateKey,
    additionalProjects: config.additional_projects || [],
  };
}
