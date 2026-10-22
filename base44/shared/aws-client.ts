// ─── AWS Discovery Client ─────────────────────────────────────────────
// Covers: Bedrock, SageMaker, Comprehend, Lex, Rekognition, Textract, Kendra
// Auth: Access Key ID + Secret Access Key (with optional session token)
//
// AWS Signature Version 4 — implemented without any npm dependencies
// https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html

// ─── AWS SigV4 signing (pure Web Crypto) ─────────────────────────────

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
}

export interface AWSSigV4Opts {
  method: string;
  service: string;
  host: string;
  path: string;
  query?: string;
  body?: string;
  contentType?: string;
}

async function awsSign(creds: AWSCredentials, opts: AWSSigV4Opts): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const body = opts.body || '';
  const payloadHash = await sha256Hex(body);

  const headers: Record<string, string> = {
    'host': opts.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...(opts.contentType ? { 'content-type': opts.contentType } : {}),
    ...(creds.sessionToken ? { 'x-amz-security-token': creds.sessionToken } : {}),
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.trim()}`)
    .join('\n') + '\n';

  const canonicalRequest = [
    opts.method.toUpperCase(),
    opts.path,
    opts.query || '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${creds.region}/${opts.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');

  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${creds.secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, creds.region);
  const kService = await hmacSha256(kRegion, opts.service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    'Authorization': authHeader,
  };
}

// ─── Generic AWS fetch helper ─────────────────────────────────────────

async function awsFetch(creds: AWSCredentials, service: string, host: string, path: string, method = 'GET', body?: string, query = '', contentType = 'application/x-amz-json-1.1') {
  const headers = await awsSign(creds, { method, service, host, path, query, body, contentType });
  const url = `https://${host}${path}${query ? '?' + query : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(body ? { 'Content-Type': contentType, 'Content-Length': String(new TextEncoder().encode(body).length) } : {}),
    },
    body: body || undefined,
    signal: AbortSignal.timeout(20000),
  });
  return res;
}

// ─── Validate credentials (via STS GetCallerIdentity) ─────────────────

export interface AWSIdentityResult {
  ok: boolean;
  accountId?: string;
  arn?: string;
  userId?: string;
  error?: string;
  status?: string;
  latency?: number;
}

export async function getAWSCallerIdentity(creds: AWSCredentials): Promise<AWSIdentityResult> {
  const t0 = Date.now();
  try {
    if (!creds.accessKeyId || !creds.secretAccessKey) {
      return { ok: false, status: 'not_configured', error: 'AWS Access Key ID and Secret Access Key are required.' };
    }

    const host = 'sts.amazonaws.com';
    const body = 'Action=GetCallerIdentity&Version=2011-06-15';
    const headers = await awsSign({ ...creds, region: 'us-east-1' }, {
      method: 'POST', service: 'sts', host, path: '/', body,
      contentType: 'application/x-www-form-urlencoded',
    });

    const res = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    if (!res.ok) {
      if (text.includes('InvalidClientTokenId') || text.includes('AccessDenied')) {
        return { ok: false, status: 'authentication_failed', error: 'AWS authentication failed: Invalid or expired credentials. Check your Access Key ID and Secret Access Key.', latency: Date.now() - t0 };
      }
      if (text.includes('SignatureDoesNotMatch')) {
        return { ok: false, status: 'authentication_failed', error: 'AWS authentication failed: Signature mismatch. Check that your Secret Access Key is correct.', latency: Date.now() - t0 };
      }
      return { ok: false, status: 'error', error: `AWS STS returned HTTP ${res.status}. Check your credentials.`, latency: Date.now() - t0 };
    }

    const accountMatch = text.match(/<Account>([^<]+)<\/Account>/);
    const arnMatch = text.match(/<Arn>([^<]+)<\/Arn>/);
    const userIdMatch = text.match(/<UserId>([^<]+)<\/UserId>/);

    return {
      ok: true,
      accountId: accountMatch?.[1],
      arn: arnMatch?.[1],
      userId: userIdMatch?.[1],
      latency: Date.now() - t0,
    };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error connecting to AWS STS: ${e.message}`, latency: Date.now() - t0 };
  }
}

// ─── AWS Bedrock — foundation model discovery ─────────────────────────

export interface AWSBedrockModel {
  modelId: string;
  modelName: string;
  providerName: string;
  inputModalities: string[];
  outputModalities: string[];
  responseStreamingSupported: boolean;
  customizationsSupported: string[];
  inferenceTypesSupported: string[];
}

export async function listBedrockFoundationModels(creds: AWSCredentials): Promise<{ ok: boolean, models: AWSBedrockModel[], error?: string, status?: string, latency?: number }> {
  const t0 = Date.now();
  try {
    const host = `bedrock.${creds.region}.amazonaws.com`;
    const res = await awsFetch(creds, 'bedrock', host, '/foundation-models', 'GET', undefined, '', 'application/json');

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || body.includes('UnauthorizedException')) {
        return { ok: false, status: 'authentication_failed', error: 'AWS Bedrock authentication failed. Check your credentials and region.', models: [], latency: Date.now() - t0 };
      }
      if (res.status === 403) {
        return { ok: false, status: 'permission_denied', error: 'Access denied to AWS Bedrock. Ensure your IAM user/role has bedrock:ListFoundationModels permission.', models: [], latency: Date.now() - t0 };
      }
      if (res.status === 404 || body.includes('not available')) {
        return { ok: false, status: 'not_available', error: `AWS Bedrock is not available in region ${creds.region}. Try us-east-1 or us-west-2.`, models: [], latency: Date.now() - t0 };
      }
      return { ok: false, status: 'error', error: `Bedrock list models failed (HTTP ${res.status})`, models: [], latency: Date.now() - t0 };
    }

    const data = await res.json() as any;
    const models: AWSBedrockModel[] = (data.modelSummaries || []).map((m: any) => ({
      modelId: m.modelId,
      modelName: m.modelName,
      providerName: m.providerName,
      inputModalities: m.inputModalities || [],
      outputModalities: m.outputModalities || [],
      responseStreamingSupported: m.responseStreamingSupported || false,
      customizationsSupported: m.customizationsSupported || [],
      inferenceTypesSupported: m.inferenceTypesSupported || [],
    }));

    return { ok: true, models, latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error querying AWS Bedrock: ${e.message}`, models: [], latency: Date.now() - t0 };
  }
}

// Bedrock custom model deployments
export async function listBedrockCustomModels(creds: AWSCredentials): Promise<{ ok: boolean, models: any[], error?: string, latency?: number }> {
  const t0 = Date.now();
  try {
    const host = `bedrock.${creds.region}.amazonaws.com`;
    const res = await awsFetch(creds, 'bedrock', host, '/custom-models', 'GET', undefined, '', 'application/json');
    if (!res.ok) return { ok: false, models: [], error: `Bedrock custom models (HTTP ${res.status})`, latency: Date.now() - t0 };
    const data = await res.json() as any;
    return { ok: true, models: data.modelSummaries || [], latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, models: [], error: e.message, latency: Date.now() - t0 };
  }
}

// ─── AWS SageMaker — endpoint discovery ──────────────────────────────

export async function listSageMakerEndpoints(creds: AWSCredentials): Promise<{ ok: boolean, endpoints: any[], error?: string, status?: string, latency?: number }> {
  const t0 = Date.now();
  try {
    const host = `api.sagemaker.${creds.region}.amazonaws.com`;
    const body = JSON.stringify({});
    const res = await awsFetch(creds, 'sagemaker', host, '/', 'POST', body, '', 'application/x-amz-json-1.1');
    // SageMaker uses a different approach — target header
    const headers = await awsSign(creds, { method: 'POST', service: 'sagemaker', host, path: '/', body });
    const res2 = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'SageMaker.ListEndpoints' },
      body,
      signal: AbortSignal.timeout(20000),
    });

    if (!res2.ok) {
      if (res2.status === 403) {
        return { ok: false, status: 'permission_denied', error: 'Access denied to SageMaker. Ensure your IAM policy includes sagemaker:ListEndpoints.', endpoints: [], latency: Date.now() - t0 };
      }
      return { ok: false, status: 'error', error: `SageMaker list endpoints failed (HTTP ${res2.status})`, endpoints: [], latency: Date.now() - t0 };
    }

    const data = await res2.json() as any;
    return { ok: true, endpoints: data.Endpoints || [], latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error querying SageMaker: ${e.message}`, endpoints: [], latency: Date.now() - t0 };
  }
}

// ─── Credential resolution ────────────────────────────────────────────

export function resolveAWSCredentials(source: any): AWSCredentials | null {
  const config = source.config || {};
  const accessKeyId = config._access_key_id || config.accessKeyId || config.access_key_id || '';
  const secretAccessKey = config._secret_access_key || config.secretAccessKey || config.secret_access_key || '';
  const sessionToken = config._session_token || config.sessionToken || config.session_token || undefined;
  const region = config.region || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey, sessionToken, region };
}
