const GITHUB_API = 'https://api.github.com';

// ─── Base64 / DER helpers for JWT generation (Web Crypto, no deps) ───

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function derLength(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  if (len < 0x100) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function derWrap(tag: number, content: Uint8Array): Uint8Array {
  const len = derLength(content.length);
  const result = new Uint8Array(1 + len.length + content.length);
  result[0] = tag;
  result.set(len, 1);
  result.set(content, 1 + len.length);
  return result;
}

// Convert PKCS1 RSA private key DER to PKCS8 DER
function pkcs1ToPkcs8(pkcs1Der: Uint8Array): Uint8Array {
  // AlgorithmIdentifier: SEQUENCE { OID rsaEncryption, NULL }
  const oid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
  const nullVal = new Uint8Array([0x05, 0x00]);
  const algId = derWrap(0x30, new Uint8Array([...oid, ...nullVal]));

  // OCTET STRING wrapping the PKCS1 key
  const octetString = derWrap(0x04, pkcs1Der);

  // Version INTEGER 0
  const version = derWrap(0x02, new Uint8Array([0x00]));

  // Top-level SEQUENCE
  return derWrap(0x30, new Uint8Array([...version, ...algId, ...octetString]));
}

async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN[^-]*-----/g, '')
    .replace(/-----END[^-]*-----/g, '')
    .replace(/\s/g, '');
  let derBytes = base64ToBytes(b64);

  const isPkcs1 = pem.includes('BEGIN RSA PRIVATE KEY');
  if (isPkcs1) {
    derBytes = pkcs1ToPkcs8(derBytes);
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    derBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function createAppJWT(appId: string, privateKeyPem: string): Promise<string> {
  const key = await importRsaPrivateKey(privateKeyPem);
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 60, exp: now + 540, iss: appId };

  const enc = (obj: any) =>
    bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${enc(header)}.${enc(payload)}`;
  const sigBuf = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(sigBuf))}`;
}

// ─── GitHub API fetch ───

// GitHub may return plain-text error bodies (e.g. missing User-Agent), so never assume JSON.
async function readBody(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 200) }; }
}

async function ghFetch(path: string, token: string, options: any = {}) {
  const timeout = options.timeout || 15000;
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: options.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'OneKor-AI-Discovery',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body,
    signal: AbortSignal.timeout(timeout),
  });
  return res;
}

// ─── PAT authentication ───

export async function getAuthenticatedUser(token: string) {
  const t0 = Date.now();
  try {
    const res = await ghFetch('/user', token, { timeout: 10000 });
    if (res.status === 401) {
      return { ok: false, status: 'authentication_failed', error: 'GitHub authentication failed. The token is invalid or expired.', latency: Date.now() - t0 };
    }
    if (res.status === 403) {
      const body = await readBody(res);
      if (body.message && body.message.includes('rate limit')) {
        return { ok: false, status: 'rate_limited', error: 'GitHub API rate limit exceeded. Please try again later.', latency: Date.now() - t0 };
      }
      return { ok: false, status: 'error', error: `GitHub API returned 403: ${body.message || 'Forbidden'}`, latency: Date.now() - t0 };
    }
    if (!res.ok) {
      return { ok: false, status: 'error', error: `GitHub API returned status ${res.status}.`, latency: Date.now() - t0 };
    }
    const user = await res.json();
    return { ok: true, user, latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error connecting to GitHub: ${e.message}`, latency: Date.now() - t0 };
  }
}

export async function listOrganizations(token: string) {
  const t0 = Date.now();
  try {
    const res = await ghFetch('/user/orgs?per_page=100', token, { timeout: 10000 });
    if (!res.ok) {
      return { ok: false, status: 'error', error: `Could not list organizations (HTTP ${res.status}).`, orgs: [], latency: Date.now() - t0 };
    }
    const orgs = await res.json();
    return {
      ok: true,
      orgs: orgs.map((o: any) => ({ login: o.login, id: o.id, avatar_url: o.avatar_url, description: o.description })),
      latency: Date.now() - t0,
    };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error listing organizations: ${e.message}`, orgs: [], latency: Date.now() - t0 };
  }
}

// ─── GitHub App authentication ───

export async function listInstallations(appId: string, privateKeyPem: string) {
  const t0 = Date.now();
  try {
    const jwt = await createAppJWT(appId, privateKeyPem);
    const res = await ghFetch('/app/installations?per_page=100', jwt, { timeout: 15000 });
    if (res.status === 401) {
      return { ok: false, status: 'authentication_failed', error: 'GitHub App authentication failed. The App ID or private key is invalid.', latency: Date.now() - t0 };
    }
    if (res.status === 403) {
      const body = await readBody(res);
      if (body.message && body.message.includes('rate limit')) {
        return { ok: false, status: 'rate_limited', error: 'GitHub API rate limit exceeded.', latency: Date.now() - t0 };
      }
      return { ok: false, status: 'permission_denied', error: `GitHub App does not have permission: ${body.message || 'Forbidden'}`, latency: Date.now() - t0 };
    }
    if (!res.ok) {
      const body = await readBody(res);
      return { ok: false, status: 'error', error: `GitHub API returned ${res.status}: ${body.message || 'Unknown error'}`, latency: Date.now() - t0 };
    }
    const installations = await res.json();
    return {
      ok: true,
      installations: installations.map((inst: any) => ({
        id: inst.id,
        account_login: inst.account?.login,
        account_type: inst.account?.type,
        account_avatar_url: inst.account?.avatar_url,
        repository_selection: inst.repository_selection,
        permissions: inst.permissions,
        app_slug: inst.app_slug,
      })),
      latency: Date.now() - t0,
    };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Failed to validate GitHub App credentials: ${e.message}`, latency: Date.now() - t0 };
  }
}

export async function getInstallationToken(appId: string, privateKeyPem: string, installationId: number) {
  const t0 = Date.now();
  try {
    const jwt = await createAppJWT(appId, privateKeyPem);
    const res = await ghFetch(`/app/installations/${installationId}/access_tokens`, jwt, {
      method: 'POST',
      timeout: 15000,
    });
    if (res.status === 401) {
      return { ok: false, status: 'authentication_failed', error: 'GitHub App JWT rejected. The private key may be invalid or expired.', latency: Date.now() - t0 };
    }
    if (res.status === 404) {
      return { ok: false, status: 'permission_denied', error: `Installation ${installationId} not found. The app may not be installed on this account.`, latency: Date.now() - t0 };
    }
    if (!res.ok) {
      const body = await readBody(res);
      return { ok: false, status: 'error', error: `Failed to get installation token (HTTP ${res.status}): ${body.message || ''}`, latency: Date.now() - t0 };
    }
    const data = await res.json();
    return { ok: true, token: data.token, expires_at: data.expires_at, permissions: data.permissions, latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Failed to get installation token: ${e.message}`, latency: Date.now() - t0 };
  }
}

export async function listInstallationRepositories(installationToken: string) {
  const t0 = Date.now();
  try {
    const res = await ghFetch('/installation/repositories?per_page=100', installationToken, { timeout: 20000 });
    if (res.status === 401) {
      return { ok: false, status: 'authentication_failed', error: 'Installation token is invalid or expired.', repos: [], latency: Date.now() - t0 };
    }
    if (!res.ok) {
      const body = await readBody(res);
      return { ok: false, status: 'error', error: `Failed to list installation repositories (HTTP ${res.status}): ${body.message || ''}`, repos: [], latency: Date.now() - t0 };
    }
    const data = await res.json();
    const repos = (data.repositories || []).map((r: any) => normalizeRepo(r));
    return { ok: true, repos, total_count: data.total_count, latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error listing installation repositories: ${e.message}`, repos: [], latency: Date.now() - t0 };
  }
}

// ─── Repository listing (shared) ───

function normalizeRepo(r: any) {
  return {
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    owner_login: r.owner?.login,
    owner_type: r.owner?.type,
    private: r.private,
    visibility: r.visibility || (r.private ? 'private' : 'public'),
    default_branch: r.default_branch,
    language: r.language,
    archived: r.archived,
    fork: r.fork,
    updated_at: r.updated_at,
    pushed_at: r.pushed_at,
    html_url: r.html_url,
    description: r.description,
    size: r.size,
  };
}

export async function listRepositories(token: string, org: string, { repoFilter }: { repoFilter?: string[] } = {}) {
  const t0 = Date.now();
  try {
    let path;
    if (org) {
      path = `/orgs/${encodeURIComponent(org)}/repos?per_page=100&sort=updated&direction=desc&type=all`;
    } else {
      path = '/user/repos?per_page=100&sort=updated&direction=desc&affiliation=owner,organization_member';
    }
    let res = await ghFetch(path, token, { timeout: 20000 });
    let ownerFilter = '';
    if (res.status === 404 && org) {
      // Not an organization — treat it as a user account. /user/repos includes private repos the token can see.
      res = await ghFetch('/user/repos?per_page=100&sort=updated&direction=desc&affiliation=owner,collaborator,organization_member', token, { timeout: 20000 });
      ownerFilter = org.toLowerCase();
    }
    if (res.status === 404) {
      return { ok: false, status: 'permission_denied', error: `Account "${org}" not found, or the token does not have access to it.`, repos: [], latency: Date.now() - t0 };
    }
    if (res.status === 403) {
      const body = await readBody(res);
      if (body.message && body.message.includes('rate limit')) {
        return { ok: false, status: 'rate_limited', error: 'GitHub API rate limit exceeded. Please try again later.', repos: [], latency: Date.now() - t0 };
      }
      return { ok: false, status: 'permission_denied', error: `GitHub authentication succeeded, but the token does not have permission to list repositories${org ? ` for organization "${org}"` : ''}.`, repos: [], latency: Date.now() - t0 };
    }
    if (!res.ok) {
      return { ok: false, status: 'error', error: `GitHub API returned status ${res.status}.`, repos: [], latency: Date.now() - t0 };
    }
    let repos = await res.json();
    if (ownerFilter) {
      repos = repos.filter((r: any) => (r.owner?.login || '').toLowerCase() === ownerFilter);
      if (repos.length === 0) {
        // Another user's account — fall back to their public repositories
        const pubRes = await ghFetch(`/users/${encodeURIComponent(org)}/repos?per_page=100&sort=updated&type=owner`, token, { timeout: 20000 });
        if (pubRes.status === 404) {
          return { ok: false, status: 'permission_denied', error: `GitHub account "${org}" not found.`, repos: [], latency: Date.now() - t0 };
        }
        if (pubRes.ok) repos = await pubRes.json();
      }
    }
    if (repoFilter && repoFilter.length > 0 && !repoFilter.includes('*')) {
      const filterLower = repoFilter.map((r) => r.toLowerCase());
      repos = repos.filter((r: any) => filterLower.includes(r.name.toLowerCase()));
    }
    // Exclude archived repos
    repos = repos.filter((r: any) => !r.archived);
    const normalized = repos.map((r: any) => normalizeRepo(r));
    return { ok: true, repos: normalized, latency: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 'error', error: `Network error listing repositories: ${e.message}`, repos: [], latency: Date.now() - t0 };
  }
}

// ─── Rate limit info ───

export async function getRateLimit(token: string) {
  const t0 = Date.now();
  try {
    const res = await ghFetch('/rate_limit', token, { timeout: 10000 });
    if (!res.ok) return { ok: false, latency: Date.now() - t0 };
    const data = await res.json();
    return {
      ok: true,
      core: { limit: data.resources?.core?.limit, remaining: data.resources?.core?.remaining, used: data.resources?.core?.used, reset: data.resources?.core?.reset },
      search: { limit: data.resources?.search?.limit, remaining: data.resources?.search?.remaining },
      latency: Date.now() - t0,
    };
  } catch (e: any) {
    return { ok: false, latency: Date.now() - t0 };
  }
}

// ─── File tree and content (existing, unchanged) ───

export async function getRepoTree(token: string, owner: string, repo: string, branch?: string) {
  try {
    const ref = branch ? `?ref=${encodeURIComponent(branch)}` : '';
    const res = await ghFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/HEAD${ref}&recursive=1`, token, { timeout: 20000 });
    if (res.status === 404) {
      const repoRes = await ghFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token, { timeout: 10000 });
      if (!repoRes.ok) return { ok: false, error: `Could not access repository ${owner}/${repo}.` };
      const repoInfo = await repoRes.json();
      const defaultBranch = branch || repoInfo.default_branch;
      const treeRes = await ghFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`, token, { timeout: 20000 });
      if (!treeRes.ok) return { ok: false, error: `Could not fetch file tree for ${owner}/${repo} on branch ${defaultBranch}.` };
      const tree = await treeRes.json();
      return { ok: true, tree: tree.tree || [], defaultBranch };
    }
    if (res.status === 403) {
      const body = await readBody(res);
      if (body.message && body.message.includes('rate limit')) {
        return { ok: false, error: 'GitHub API rate limit exceeded.' };
      }
      return { ok: false, error: `Permission denied accessing file tree for ${owner}/${repo}.` };
    }
    if (!res.ok) {
      return { ok: false, error: `GitHub API returned status ${res.status} for ${owner}/${repo}.` };
    }
    const data = await res.json();
    return { ok: true, tree: data.tree || [], defaultBranch: branch || 'HEAD' };
  } catch (e: any) {
    return { ok: false, error: `Network error fetching file tree: ${e.message}` };
  }
}

export async function getFileContent(token: string, owner: string, repo: string, path: string, branch?: string) {
  try {
    const ref = branch ? `?ref=${encodeURIComponent(branch)}` : '';
    const res = await ghFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}${ref}`, token, { timeout: 10000, raw: true });
    if (!res.ok) {
      return { ok: false, error: `Could not fetch ${path} from ${owner}/${repo}.` };
    }
    const content = await res.text();
    const truncated = content.length > 102400;
    return { ok: true, content: truncated ? content.slice(0, 102400) : content, truncated };
  } catch (e: any) {
    return { ok: false, error: `Network error fetching ${path}: ${e.message}` };
  }
}

export function identifyInterestingFiles(tree: any[], pathFilter?: string) {
  const interestingPaths = new Set([
    'package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml',
    'pom.xml', '.env.example', '.env.sample', 'docker-compose.yml', 'docker-compose.yaml',
    'config.yaml', 'config.json', 'config.toml',
  ]);

  const files: any[] = [];
  for (const item of tree) {
    if (item.type !== 'blob') continue;
    if (pathFilter && pathFilter.trim()) {
      if (!item.path.includes(pathFilter.trim())) continue;
    }
    if (interestingPaths.has(item.path)) {
      files.push({ path: item.path, fileType: classifyFile(item.path) });
      continue;
    }
    if (item.path.startsWith('.github/workflows/') && (item.path.endsWith('.yml') || item.path.endsWith('.yaml'))) {
      files.push({ path: item.path, fileType: 'workflow' });
      continue;
    }
    if (item.path.endsWith('.py') && !item.path.includes('test') && !item.path.includes('__pycache__')) {
      const basename = item.path.split('/').pop().toLowerCase();
      if (['llm.py', 'ai.py', 'model.py', 'agent.py', 'gpt.py', 'claude.py', 'openai.py', 'chat.py', 'assistant.py', 'embed.py', 'rag.py', 'prompt.py', 'inference.py'].includes(basename)) {
        files.push({ path: item.path, fileType: 'python_source' });
      }
    }
  }
  return files.slice(0, 15);
}

function classifyFile(path: string) {
  if (path === 'package.json') return 'package_json';
  if (path === 'requirements.txt') return 'requirements_txt';
  if (path === 'pyproject.toml') return 'pyproject_toml';
  if (path === 'go.mod') return 'go_mod';
  if (path === 'Cargo.toml') return 'cargo_toml';
  if (path === 'pom.xml') return 'pom_xml';
  if (path.startsWith('.env')) return 'env_file';
  if (path.startsWith('docker-compose')) return 'docker_compose';
  if (path.startsWith('config.')) return 'config_file';
  return 'unknown';
}

export async function resolveToken(source: any): Promise<{ ok: boolean; token?: string; error?: string; authMethod?: string }> {
  const config = source.config || {};
  const authMethod = config.auth_method || config.authMethod || 'pat';

  if (authMethod === 'pat') {
    const token = config._token || config.token;
    if (!token) {
      return { ok: false, error: 'No personal access token configured for this source.' };
    }
    return { ok: true, token, authMethod: 'pat' };
  }

  if (authMethod === 'github_app') {
    const appId = config._app_id || config.appId;
    const privateKey = config._private_key || config.privateKey;
    const installationId = config._installation_id || config.installationId;
    if (!appId || !privateKey || !installationId) {
      return { ok: false, error: 'GitHub App credentials are incomplete. App ID, private key, and installation are all required.' };
    }
    const tokenResult = await getInstallationToken(String(appId), privateKey, parseInt(String(installationId), 10));
    if (!tokenResult.ok) {
      return { ok: false, error: tokenResult.error || 'Failed to get installation token.' };
    }
    return { ok: true, token: tokenResult.token, authMethod: 'github_app' };
  }

  return { ok: false, error: `Unsupported authentication method: ${authMethod}` };
}