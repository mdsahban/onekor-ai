const OPENAI_API = 'https://api.openai.com/v1';

// ─── Response helpers ───

async function readBody(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: { message: text.slice(0, 200) } }; }
}

interface FetchOptions {
  method?: string;
  timeout?: number;
  organization?: string;
  project?: string;
  body?: string;
}

async function openaiFetch(path: string, apiKey: string, options: FetchOptions = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (options.organization) headers['OpenAI-Organization'] = options.organization;
  if (options.project) headers['OpenAI-Project'] = options.project;

  return await fetch(`${OPENAI_API}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body,
    signal: AbortSignal.timeout(options.timeout || 15000),
  });
}

function handleError(status: number, body: any, t0: number) {
  const msg = body?.error?.message || body?.message || 'Unknown error';
  if (status === 401) {
    return { ok: false, status: 'authentication_failed', error: `OpenAI authentication failed. The API key is invalid or expired. (${msg})`, latency: Date.now() - t0 };
  }
  if (status === 403) {
    return { ok: false, status: 'permission_denied', error: `OpenAI API denied access: ${msg}`, latency: Date.now() - t0 };
  }
  if (status === 429) {
    return { ok: false, status: 'rate_limited', error: `OpenAI API rate limit exceeded. ${msg}`, latency: Date.now() - t0 };
  }
  return { ok: false, status: 'error', error: `OpenAI API returned status ${status}: ${msg}`, latency: Date.now() - t0 };
}

// ─── Validate API key ───

export async function validateApiKey(apiKey: string, organization?: string, project?: string) {
  const t0 = Date.now();
  try {
    if (!apiKey || apiKey.trim().length < 10) {
      return { ok: false, status: 'authentication_failed', error: 'The API key appears to be empty or too short.', latency: 0 };
    }
    const res = await openaiFetch('/models', apiKey.trim(), { organization, project, timeout: 10000 });
    if (!res.ok) {
      const body = await readBody(res);
      return handleError(res.status, body, t0);
    }
    const data = await res.json();
    return { ok: true, data, latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error connecting to OpenAI: ${e.message}`, latency: Date.now() - t0 };
  }
}

// ─── List models ───

export interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  shutdown_date: string | null;
}

export async function listModels(apiKey: string, organization?: string, project?: string) {
  const t0 = Date.now();
  const result = await validateApiKey(apiKey, organization, project);
  if (!result.ok) return result;

  const rawModels = (result.data?.data || []) as any[];
  const models: OpenAIModel[] = rawModels.map((m) => ({
    id: m.id,
    object: m.object,
    created: m.created,
    owned_by: m.owned_by,
    shutdown_date: m.shutdown_date ?? null,
  }));

  // Extract unique organizations from owned_by
  const organizations = [...new Set(models.map((m) => m.owned_by).filter(Boolean))];

  return {
    ok: true,
    models,
    organizations,
    model_count: models.length,
    latency: result.latency,
  };
}

// ─── Get account info (from models response) ───

export async function getAccountInfo(apiKey: string, organization?: string, project?: string) {
  const t0 = Date.now();
  const modelsResult = await listModels(apiKey, organization, project);
  if (!modelsResult.ok) return modelsResult;

  // OpenAI's public API does not expose user email, name, or detailed org metadata
  // We extract what we can from the models response (owned_by field)
  return {
    ok: true,
    account: {
      organizations: modelsResult.organizations,
      model_count: modelsResult.model_count,
      // Fields not available through the public API:
      user_email: null,
      user_name: null,
      plan: null,
      organization_name: null,
      organization_id: organization || null,
      project_id: project || null,
    },
    models: modelsResult.models,
    latency: Date.now() - t0,
  };
}

// ─── Credential resolution ───

export async function resolveCredentials(source: any) {
  const config = source.config || {};
  const apiKey = config._api_key || config.apiKey;
  if (!apiKey) {
    return { ok: false, error: 'No API key configured for this source.' };
  }
  return {
    ok: true,
    apiKey,
    organization: config.organization || undefined,
    project: config.project || undefined,
  };
}