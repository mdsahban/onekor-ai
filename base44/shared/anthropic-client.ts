const ANTHROPIC_API = 'https://api.anthropic.com/v1';

// ─── Response helpers ───

async function readBody(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: { message: text.slice(0, 200) } }; }
}

interface FetchOptions {
  method?: string;
  timeout?: number;
  body?: string;
}

async function anthropicFetch(path: string, apiKey: string, options: FetchOptions = {}) {
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  };

  return await fetch(`${ANTHROPIC_API}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body,
    signal: AbortSignal.timeout(options.timeout || 15000),
  });
}

function handleError(status: number, body: any, t0: number) {
  const msg = body?.error?.message || body?.message || 'Unknown error';
  if (status === 401) {
    return { ok: false, status: 'authentication_failed', error: `Anthropic authentication failed. The API key is invalid or expired. (${msg})`, latency: Date.now() - t0 };
  }
  if (status === 403) {
    return { ok: false, status: 'permission_denied', error: `Anthropic API denied access: ${msg}`, latency: Date.now() - t0 };
  }
  if (status === 429) {
    return { ok: false, status: 'rate_limited', error: `Anthropic API rate limit exceeded. ${msg}`, latency: Date.now() - t0 };
  }
  return { ok: false, status: 'error', error: `Anthropic API returned status ${status}: ${msg}`, latency: Date.now() - t0 };
}

// ─── Validate API key ───

export async function validateApiKey(apiKey: string) {
  const t0 = Date.now();
  try {
    if (!apiKey || apiKey.trim().length < 10) {
      return { ok: false, status: 'authentication_failed', error: 'The API key appears to be empty or too short.', latency: 0 };
    }
    const res = await anthropicFetch('/models?limit=1', apiKey.trim(), { timeout: 10000 });
    if (!res.ok) {
      const body = await readBody(res);
      return handleError(res.status, body, t0);
    }
    const data = await res.json();
    return { ok: true, data, latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error connecting to Anthropic: ${e.message}`, latency: Date.now() - t0 };
  }
}

// ─── List all models (with pagination) ───

export interface AnthropicModel {
  id: string;
  display_name: string;
  type: string;
  created_at: string;
  capabilities?: any;
  lifecycle?: string;
  max_input_tokens?: number;
  max_tokens?: number;
  deprecated_at?: string | null;
  retires_at?: string | null;
}

export async function listModels(apiKey: string) {
  const t0 = Date.now();
  try {
    const allModels: AnthropicModel[] = [];
    let after: string | undefined = undefined;
    let hasMore = true;
    let pages = 0;
    const maxPages = 20; // Safety limit

    while (hasMore && pages < maxPages) {
      const path = `/models?limit=100${after ? `&after=${after}` : ''}`;
      const res = await anthropicFetch(path, apiKey.trim(), { timeout: 15000 });
      if (!res.ok) {
        const body = await readBody(res);
        if (pages === 0) return handleError(res.status, body, t0);
        // If we already have some models, log a warning but continue
        hasMore = false;
        break;
      }
      const data = await res.json();
      const models = (data.data || []) as any[];
      for (const m of models) {
        allModels.push({
          id: m.id,
          display_name: m.display_name || m.id,
          type: m.type || 'model',
          created_at: m.created_at,
          capabilities: m.capabilities,
          lifecycle: m.lifecycle,
          max_input_tokens: m.max_input_tokens,
          max_tokens: m.max_tokens,
          deprecated_at: m.deprecated_at,
          retires_at: m.retires_at,
        });
      }
      hasMore = data.has_more === true;
      after = data.last_id;
      pages++;
    }

    return {
      ok: true,
      models: allModels,
      model_count: allModels.length,
      latency: Date.now() - t0,
    };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error listing Anthropic models: ${e.message}`, latency: Date.now() - t0 };
  }
}

// ─── Get account info ───

export async function getAccountInfo(apiKey: string) {
  const t0 = Date.now();
  const modelsResult = await listModels(apiKey);
  if (!modelsResult.ok) return modelsResult;

  // Anthropic's public API does not expose organization, user, or account metadata
  return {
    ok: true,
    account: {
      model_count: modelsResult.model_count,
      // Fields not available through the public API:
      organization_name: null,
      organization_id: null,
      user_email: null,
      user_name: null,
      plan: null,
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
  return { ok: true, apiKey };
}