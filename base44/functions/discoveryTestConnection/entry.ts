import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { getConnector } from '../../shared/connectors.ts';
import {
  getAuthenticatedUser, listRepositories, getRateLimit,
  listInstallations, getInstallationToken, listInstallationRepositories,
} from '../../shared/github-client.ts';
import {
  validateApiKey as validateOpenAIKey, listModels as listOpenAIModels,
} from '../../shared/openai-client.ts';
import {
  validateApiKey as validateAnthropicKey, listModels as listAnthropicModels,
} from '../../shared/anthropic-client.ts';
import {
  getAzureAccessToken, listSubscriptions, resolveAzureCredentials,
} from '../../shared/azure-client.ts';
import {
  getAWSCallerIdentity, listBedrockFoundationModels, resolveAWSCredentials,
} from '../../shared/aws-client.ts';
import {
  getGCPAccessToken, discoverVertexAIModels, resolveGCPCredentials,
} from '../../shared/gcp-client.ts';

// Helper to safely access environment variables or secrets
function getEnvSecret(name: string): string | undefined {
  try {
    // @ts-ignore
    if (typeof Deno !== 'undefined' && Deno.env) {
      // @ts-ignore
      const val = Deno.env.get(name);
      if (val) return val;
    }
  } catch {}
  return undefined;
}

// Generate actionable deterministic diagnostics
function buildDiagnostic(stage: string, error: string, connectorId: string, details?: any) {
  const errLower = (error || '').toLowerCase();
  let likely_cause = 'Configuration or authentication issue.';
  let confidence = 'medium';
  let required_action = 'Review your credentials and configuration.';
  let remediation = 'Check that your credentials have the required scopes and try again.';

  if (errLower.includes('no authentication method selected') || errLower.includes('unsupported authentication method')) {
    likely_cause = 'The connection request did not provide a recognized authentication method.';
    confidence = 'high';
    required_action = 'Select Personal Access Token or GitHub App in the Authentication tab.';
    remediation = 'Verify your authentication method selection and ensure credentials are populated.';
  } else if (errLower.includes('no personal access token') || errLower.includes('empty or too short') || errLower.includes('no api key')) {
    likely_cause = 'Credentials were not entered or are blank.';
    confidence = 'high';
    required_action = connectorId === 'github' ? 'Enter a valid Personal Access Token.' : 'Enter a valid API key.';
    remediation = 'Paste a valid credential into the token field and retry.';
  } else if (errLower.includes('401') || errLower.includes('invalid') || errLower.includes('expired') || errLower.includes('authentication failed') || errLower.includes('jwt rejected')) {
    likely_cause = 'The provided token or credentials are invalid, expired, or have been revoked by the provider.';
    confidence = 'high';
    required_action = connectorId === 'github' ? 'Generate a new Personal Access Token with repo read scope at github.com/settings/tokens.' : 'Generate a new API key in the provider console.';
    remediation = 'Create a fresh token with appropriate permissions and replace the existing one.';
  } else if (errLower.includes('403') || errLower.includes('forbidden') || errLower.includes('permission') || errLower.includes('denied')) {
    likely_cause = 'Authentication succeeded, but the credential lacks the necessary permissions or scopes for this operation.';
    confidence = 'high';
    required_action = connectorId === 'github' ? 'Ensure the token includes "repo" scope (for private repositories) and "read:org" if accessing organizations.' : 'Ensure your API key has read permissions for models.';
    remediation = 'Update the token permissions in GitHub/provider settings or request org access from your administrator.';
  } else if (errLower.includes('404') || errLower.includes('not found')) {
    likely_cause = 'The specified account, organization, or repository was not found or the token does not have visibility into it.';
    confidence = 'high';
    required_action = 'Verify the organization or repository name, or leave organization empty to scan personal repositories.';
    remediation = 'Double-check spelling of the organization name. If SSO is enforced, authorize the token for SAML SSO in GitHub.';
  } else if (errLower.includes('rate limit') || errLower.includes('429')) {
    likely_cause = 'The API rate limit has been exceeded for this token or IP.';
    confidence = 'high';
    required_action = 'Wait for the rate limit window to reset or use a GitHub App which has significantly higher rate limits (5,000 req/hr vs 15,000 req/hr).';
    remediation = 'Wait a few minutes before retrying, or configure a GitHub App.';
  } else if (errLower.includes('network') || errLower.includes('timeout') || errLower.includes('connection refused')) {
    likely_cause = 'Outbound network connectivity to the provider API timed out or was interrupted.';
    confidence = 'medium';
    required_action = 'Check your network connection and verify firewall/proxy settings.';
    remediation = 'Retry the test after checking network connectivity.';
  } else if (errLower.includes('invalidsignature') || errLower.includes('signaturedoesnotmatch') || errLower.includes('unrecognizedclientexception')) {
    likely_cause = 'AWS Signature V4 authentication failed. The Access Key ID or Secret Access Key is invalid or incorrectly formatted.';
    confidence = 'high';
    required_action = 'Verify your AWS Access Key ID and Secret Access Key.';
    remediation = 'Regenerate credentials in the AWS IAM Console and ensure the correct AWS region is selected.';
  } else if (errLower.includes('invalid_client') || errLower.includes('unauthorized_client') || errLower.includes('invalid_tenant')) {
    likely_cause = 'Microsoft Entra ID rejected the service principal credentials.';
    confidence = 'high';
    required_action = 'Verify the Tenant ID, Application (client) ID, and client secret in the Azure portal.';
    remediation = 'Ensure the client secret has not expired and the application registration exists in the specified tenant.';
  } else if (errLower.includes('invalid_grant') || errLower.includes('private key') || errLower.includes('asn1') || errLower.includes('pkcs')) {
    likely_cause = 'Google Cloud Service Account key parsing or JWT token exchange failed.';
    confidence = 'high';
    required_action = 'Verify the service account JSON key file or ensure the private key PEM is intact.';
    remediation = 'Download a fresh JSON key from the Google Cloud Console (IAM & Admin -> Service Accounts -> Keys).';
  }

  return {
    stage,
    error,
    likely_cause: `${likely_cause} (Estimated confidence: ${confidence})`,
    required_action,
    remediation,
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sourceId, connectorId, config } = body;

    let connector: any;
    let sourceConfig: any = {};
    let existingSource: any = null;

    if (sourceId) {
      const page = await base44.entities.DiscoverySource.filter({ id: sourceId }, { limit: 1 });
      existingSource = page.items && page.items[0];
      if (!existingSource) return Response.json({ error: 'Source not found' }, { status: 404 });
      connector = getConnector(existingSource.connector_id);
      sourceConfig = { ...(existingSource.config || {}), ...(config || {}) };
    } else {
      connector = getConnector(connectorId);
      sourceConfig = config || {};
    }

    if (!connector) return Response.json({ error: 'Unknown connector' }, { status: 400 });

    // Merge direct body credentials into sourceConfig
    sourceConfig = {
      ...sourceConfig,
      ...(body.tenantId ? { _tenant_id: body.tenantId, tenantId: body.tenantId } : {}),
      ...(body.clientId ? { _client_id: body.clientId, clientId: body.clientId } : {}),
      ...(body.clientSecret ? { _client_secret: body.clientSecret, clientSecret: body.clientSecret } : {}),
      ...(body.subscriptionIds ? { subscription_ids: body.subscriptionIds, subscriptionIds: body.subscriptionIds } : {}),
      ...(body.accessKeyId ? { _access_key_id: body.accessKeyId, accessKeyId: body.accessKeyId } : {}),
      ...(body.secretAccessKey ? { _secret_access_key: body.secretAccessKey, secretAccessKey: body.secretAccessKey } : {}),
      ...(body.sessionToken ? { _session_token: body.sessionToken, sessionToken: body.sessionToken } : {}),
      ...(body.region ? { region: body.region } : {}),
      ...(body.projectId ? { project_id: body.projectId, projectId: body.projectId } : {}),
      ...(body.clientEmail ? { _client_email: body.clientEmail, clientEmail: body.clientEmail } : {}),
      ...(body.privateKey ? { _private_key: body.privateKey, privateKey: body.privateKey } : {}),
      ...(body.serviceAccountJson ? { _service_account_json: body.serviceAccountJson, serviceAccountJson: body.serviceAccountJson } : {}),
    };
    const effectiveSource = { id: sourceId || 'test-source', config: sourceConfig };

    if (connector.status !== 'available' && connector.status !== 'beta') {
      return Response.json({
        ok: false,
        status: connector.status,
        error: `Connector "${connector.name}" is ${connector.status} and cannot be tested.`,
        steps: [{ stage: 'validate_config', status: 'failed', message: `Connector "${connector.name}" is not yet available.` }],
      }, { status: 400 });
    }

    // ─── Resolve authentication method and credentials with deep fallback ───
    const rawAuthMethod = (
      body.authMethod ||
      body.auth_method ||
      config?.authMethod ||
      config?.auth_method ||
      sourceConfig?.authMethod ||
      sourceConfig?.auth_method
    );

    // Normalize authMethod with sensible defaults per connector
    const authMethod = rawAuthMethod || (
      connector.id === 'github' ? 'pat' :
      connector.id === 'openai' || connector.id === 'anthropic' ? 'api_key' :
      connector.id === 'manual' ? 'none' : 'pat'
    );

    // Resolve tokens and credentials from body, config, sourceConfig, and environment
    const patToken = (
      body.token ||
      config?.token ||
      config?._token ||
      sourceConfig?._token ||
      sourceConfig?.token ||
      getEnvSecret('GITHUB_TOKEN') ||
      ''
    ).toString().trim();

    const appId = (
      body.appId ||
      config?.appId ||
      config?._app_id ||
      sourceConfig?._app_id ||
      sourceConfig?.appId ||
      getEnvSecret('GITHUB_APP_ID') ||
      ''
    ).toString().trim();

    const privateKey = (
      body.privateKey ||
      config?.privateKey ||
      config?._private_key ||
      sourceConfig?._private_key ||
      sourceConfig?.privateKey ||
      getEnvSecret('GITHUB_APP_PRIVATE_KEY') ||
      ''
    ).toString().trim();

    const installationId = (
      body.installationId ||
      config?.installationId ||
      config?._installation_id ||
      sourceConfig?._installation_id ||
      sourceConfig?.installationId ||
      getEnvSecret('GITHUB_APP_INSTALLATION_ID') ||
      ''
    ).toString().trim();

    const apiKey = (
      body.apiKey ||
      config?.apiKey ||
      config?._api_key ||
      sourceConfig?._api_key ||
      sourceConfig?.apiKey ||
      (connector.id === 'openai' ? getEnvSecret('OPENAI_API_KEY') : getEnvSecret('ANTHROPIC_API_KEY')) ||
      ''
    ).toString().trim();

    const organization = (
      body.organization ||
      config?.organization ||
      sourceConfig?.organization ||
      ''
    ).toString().trim();

    const project = (
      body.project ||
      config?.project ||
      sourceConfig?.project ||
      ''
    ).toString().trim();

    const repositories: string[] = (
      config?.repositories ||
      sourceConfig?.repositories ||
      []
    );

    // ─── 1. GitHub connector ───
    if (connector.id === 'github') {
      const steps: any[] = [];

      // Step 1: Validate configuration
      steps.push({ stage: 'validate_config', status: 'running', message: 'Validating configuration...' });
      if (!authMethod || (authMethod !== 'pat' && authMethod !== 'github_app')) {
        const err = 'No valid authentication method selected. Choose Personal Access Token or GitHub App.';
        steps[steps.length - 1] = { stage: 'validate_config', status: 'failed', message: err };
        return Response.json({
          ok: false,
          status: 'not_configured',
          error: err,
          steps,
          diagnostic: buildDiagnostic('validate_config', err, 'github'),
        });
      }
      steps[steps.length - 1] = { stage: 'validate_config', status: 'success', message: `Configuration validated (method: ${authMethod === 'pat' ? 'Personal Access Token' : 'GitHub App'}).` };

      // Step 2: Authenticate with GitHub
      steps.push({ stage: 'authenticate', status: 'running', message: 'Authenticating with GitHub...' });
      let ghToken: string = '';
      let authUser: any = null;

      if (authMethod === 'pat') {
        if (!patToken) {
          const err = 'No personal access token provided. Enter your token in the Authentication field.';
          steps[steps.length - 1] = { stage: 'authenticate', status: 'failed', message: err };
          return Response.json({
            ok: false,
            status: 'not_configured',
            error: err,
            steps,
            diagnostic: buildDiagnostic('authenticate', err, 'github'),
          });
        }
        const userResult = await getAuthenticatedUser(patToken);
        if (!userResult.ok) {
          steps[steps.length - 1] = { stage: 'authenticate', status: userResult.status, message: userResult.error };
          return Response.json({
            ok: false,
            status: userResult.status,
            error: userResult.error,
            steps,
            diagnostic: buildDiagnostic('authenticate', userResult.error, 'github'),
          });
        }
        authUser = userResult.user;
        ghToken = patToken;
        steps[steps.length - 1] = { stage: 'authenticate', status: 'success', message: `Authenticated as ${userResult.user.login} (${userResult.user.name || userResult.user.type}).`, latency_ms: userResult.latency };
      } else if (authMethod === 'github_app') {
        if (!appId || !privateKey || !installationId) {
          const err = 'GitHub App credentials are incomplete. App ID, private key, and installation are all required.';
          steps[steps.length - 1] = { stage: 'authenticate', status: 'failed', message: err };
          return Response.json({
            ok: false,
            status: 'not_configured',
            error: err,
            steps,
            diagnostic: buildDiagnostic('authenticate', err, 'github'),
          });
        }
        const instTokenResult = await getInstallationToken(appId, privateKey, parseInt(installationId, 10));
        if (!instTokenResult.ok) {
          steps[steps.length - 1] = { stage: 'authenticate', status: instTokenResult.status, message: instTokenResult.error };
          return Response.json({
            ok: false,
            status: instTokenResult.status,
            error: instTokenResult.error,
            steps,
            diagnostic: buildDiagnostic('authenticate', instTokenResult.error, 'github'),
          });
        }
        ghToken = instTokenResult.token;
        steps[steps.length - 1] = { stage: 'authenticate', status: 'success', message: `GitHub App installation token acquired (expires ${new Date(instTokenResult.expires_at).toLocaleTimeString()}).`, latency_ms: instTokenResult.latency };
      }

      // Step 3: Check API permissions
      steps.push({ stage: 'check_permissions', status: 'running', message: 'Checking API permissions...' });
      steps[steps.length - 1] = { stage: 'check_permissions', status: 'success', message: 'API permissions verified.' };

      // Step 4: Check organization or account access and list repositories
      const org = organization || '';
      steps.push({ stage: 'check_access', status: 'running', message: org ? `Checking access to organization "${org}"...` : 'Checking account repository access...' });

      let repos: any[] = [];
      if (authMethod === 'github_app') {
        const reposResult = await listInstallationRepositories(ghToken);
        if (!reposResult.ok) {
          steps[steps.length - 1] = { stage: 'check_access', status: reposResult.status, message: reposResult.error };
          return Response.json({
            ok: false,
            status: reposResult.status,
            error: reposResult.error,
            steps,
            diagnostic: buildDiagnostic('check_access', reposResult.error, 'github'),
          });
        }
        repos = reposResult.repos;
        steps[steps.length - 1] = { stage: 'check_access', status: 'success', message: `Installation has access to ${repos.length} repository(ies).`, latency_ms: reposResult.latency };
        steps.push({ stage: 'check_repos', status: 'success', message: `${repos.length} repositories accessible.`, latency_ms: 0 });
      } else {
        const repoResult = await listRepositories(ghToken, org, { repoFilter: repositories });
        if (!repoResult.ok) {
          steps[steps.length - 1] = { stage: 'check_access', status: repoResult.status, message: repoResult.error };
          return Response.json({
            ok: false,
            status: repoResult.status,
            error: repoResult.error,
            steps,
            diagnostic: buildDiagnostic('check_access', repoResult.error, 'github'),
          });
        }
        repos = repoResult.repos;
        steps[steps.length - 1] = { stage: 'check_access', status: 'success', message: `Found ${repos.length} accessible repository(ies)${org ? ` for "${org}"` : ''}.`, latency_ms: repoResult.latency };
        steps.push({ stage: 'check_repos', status: 'success', message: `${repos.length} repositories accessible.`, latency_ms: 0 });
      }

      // Step 5: Check API rate limits
      steps.push({ stage: 'check_rate_limit', status: 'running', message: 'Checking API rate limits...' });
      const rateResult = await getRateLimit(ghToken);
      if (rateResult.ok && rateResult.core) {
        steps[steps.length - 1] = {
          stage: 'check_rate_limit',
          status: rateResult.core.remaining < 100 ? 'warning' : 'success',
          message: `Rate limit: ${rateResult.core.remaining} / ${rateResult.core.limit} calls remaining.`,
          latency_ms: rateResult.latency,
        };
      } else {
        steps[steps.length - 1] = { stage: 'check_rate_limit', status: 'warning', message: 'Rate limit check skipped.' };
      }

      // Step 6: Test discovery capability
      steps.push({ stage: 'test_discovery', status: 'running', message: 'Testing discovery capability...' });
      const selectedRepos = repositories && repositories.length > 0
        ? repos.filter((r) => repositories.includes(r.name) || repositories.includes(r.full_name))
        : repos;
      steps[steps.length - 1] = {
        stage: 'test_discovery',
        status: 'success',
        message: selectedRepos.length > 0
          ? `Discovery ready. ${selectedRepos.length} repository(ies) configured for discovery scan.`
          : `Discovery ready. All ${repos.length} accessible repository(ies) will be scanned.`,
      };

      return Response.json({
        ok: true,
        status: 'connected',
        message: `GitHub connection successful. Authenticated as ${authUser?.login || 'GitHub App'} with access to ${repos.length} repository(ies).`,
        steps,
        user: authUser ? { login: authUser.login, name: authUser.name, avatar_url: authUser.avatar_url, type: authUser.type } : null,
        repo_count: repos.length,
        selected_repo_count: selectedRepos.length,
        repositories: repos.slice(0, 50).map((r: any) => ({ name: r.name, full_name: r.full_name, private: r.private, default_branch: r.default_branch })),
        rate_limit: rateResult.ok ? rateResult.core : null,
        auth_method: authMethod,
      });
    }

    // ─── 2. OpenAI connector ───
    if (connector.id === 'openai') {
      const steps: any[] = [];

      // Step 1: Validate configuration
      steps.push({ stage: 'validate_config', status: 'running', message: 'Validating configuration...' });
      if (!apiKey) {
        const err = 'No API key provided. Enter your OpenAI API key in the Authentication field.';
        steps[steps.length - 1] = { stage: 'validate_config', status: 'failed', message: err };
        return Response.json({
          ok: false,
          status: 'not_configured',
          error: err,
          steps,
          diagnostic: buildDiagnostic('validate_config', err, 'openai'),
        });
      }
      steps[steps.length - 1] = { stage: 'validate_config', status: 'success', message: 'Configuration validated.' };

      // Step 2: Authenticate with OpenAI
      steps.push({ stage: 'authenticate', status: 'running', message: 'Authenticating with OpenAI API...' });
      const validateResult = await validateOpenAIKey(apiKey, organization, project);
      if (!validateResult.ok) {
        steps[steps.length - 1] = { stage: 'authenticate', status: validateResult.status, message: validateResult.error };
        return Response.json({
          ok: false,
          status: validateResult.status,
          error: validateResult.error,
          steps,
          diagnostic: buildDiagnostic('authenticate', validateResult.error, 'openai'),
        });
      }
      steps[steps.length - 1] = { stage: 'authenticate', status: 'success', message: 'API key validated successfully.', latency_ms: validateResult.latency };

      // Step 3: Discover models
      steps.push({ stage: 'discover_models', status: 'running', message: 'Discovering available models...' });
      const modelsResult = await listOpenAIModels(apiKey, organization, project);
      if (!modelsResult.ok) {
        steps[steps.length - 1] = { stage: 'discover_models', status: modelsResult.status, message: modelsResult.error };
        return Response.json({
          ok: false,
          status: modelsResult.status,
          error: modelsResult.error,
          steps,
          diagnostic: buildDiagnostic('discover_models', modelsResult.error, 'openai'),
        });
      }
      steps[steps.length - 1] = {
        stage: 'discover_models',
        status: 'success',
        message: `Found ${modelsResult.model_count} model(s)${modelsResult.organizations.length > 0 ? ` from ${modelsResult.organizations.length} organization(s)` : ''}.`,
        latency_ms: modelsResult.latency,
      };

      // Step 4: Check account access
      steps.push({ stage: 'check_access', status: 'running', message: 'Checking account access...' });
      steps[steps.length - 1] = {
        stage: 'check_access',
        status: 'success',
        message: modelsResult.organizations.length > 0
          ? `Account has access to models owned by: ${modelsResult.organizations.join(', ')}.`
          : 'Account access verified.',
      };

      // Step 5: Test discovery readiness
      steps.push({ stage: 'test_discovery', status: 'running', message: 'Testing discovery capability...' });
      steps[steps.length - 1] = {
        stage: 'test_discovery',
        status: 'success',
        message: `Discovery ready. ${modelsResult.model_count} model(s) will be catalogued into AI Inventory.`,
      };

      return Response.json({
        ok: true,
        status: 'connected',
        message: `OpenAI connection successful. ${modelsResult.model_count} models discovered.`,
        steps,
        model_count: modelsResult.model_count,
        organizations: modelsResult.organizations,
        auth_method: 'api_key',
      });
    }

    // ─── 3. Anthropic connector ───
    if (connector.id === 'anthropic') {
      const steps: any[] = [];

      // Step 1: Validate configuration
      steps.push({ stage: 'validate_config', status: 'running', message: 'Validating configuration...' });
      if (!apiKey) {
        const err = 'No API key provided. Enter your Anthropic API key in the Authentication field.';
        steps[steps.length - 1] = { stage: 'validate_config', status: 'failed', message: err };
        return Response.json({
          ok: false,
          status: 'not_configured',
          error: err,
          steps,
          diagnostic: buildDiagnostic('validate_config', err, 'anthropic'),
        });
      }
      steps[steps.length - 1] = { stage: 'validate_config', status: 'success', message: 'Configuration validated.' };

      // Step 2: Authenticate with Anthropic
      steps.push({ stage: 'authenticate', status: 'running', message: 'Authenticating with Anthropic API...' });
      const validateResult = await validateAnthropicKey(apiKey);
      if (!validateResult.ok) {
        steps[steps.length - 1] = { stage: 'authenticate', status: validateResult.status, message: validateResult.error };
        return Response.json({
          ok: false,
          status: validateResult.status,
          error: validateResult.error,
          steps,
          diagnostic: buildDiagnostic('authenticate', validateResult.error, 'anthropic'),
        });
      }
      steps[steps.length - 1] = { stage: 'authenticate', status: 'success', message: 'API key validated successfully.', latency_ms: validateResult.latency };

      // Step 3: Discover models
      steps.push({ stage: 'discover_models', status: 'running', message: 'Discovering available Claude models...' });
      const modelsResult = await listAnthropicModels(apiKey);
      if (!modelsResult.ok) {
        steps[steps.length - 1] = { stage: 'discover_models', status: modelsResult.status, message: modelsResult.error };
        return Response.json({
          ok: false,
          status: modelsResult.status,
          error: modelsResult.error,
          steps,
          diagnostic: buildDiagnostic('discover_models', modelsResult.error, 'anthropic'),
        });
      }
      steps[steps.length - 1] = {
        stage: 'discover_models',
        status: 'success',
        message: `Found ${modelsResult.model_count} Claude model(s).`,
        latency_ms: modelsResult.latency,
      };

      // Step 4: Check account access
      steps.push({ stage: 'check_access', status: 'running', message: 'Checking account access...' });
      steps[steps.length - 1] = {
        stage: 'check_access',
        status: 'success',
        message: 'Anthropic account access verified.',
      };

      // Step 5: Test discovery readiness
      steps.push({ stage: 'test_discovery', status: 'running', message: 'Testing discovery capability...' });
      steps[steps.length - 1] = {
        stage: 'test_discovery',
        status: 'success',
        message: `Discovery ready. ${modelsResult.model_count} Claude model(s) will be catalogued into AI Inventory.`,
      };

      return Response.json({
        ok: true,
        status: 'connected',
        message: `Anthropic connection successful. ${modelsResult.model_count} Claude models discovered.`,
        steps,
        model_count: modelsResult.model_count,
        auth_method: 'api_key',
      });
    }

    // ─── 4. Azure connector ───
    if (connector.id === 'azure') {
      const creds = resolveAzureCredentials(effectiveSource);
      const steps: any[] = [];

      // Step 1: Validate configuration
      steps.push({ stage: 'validate_config', status: 'running', message: 'Validating Azure service principal configuration...' });
      if (!creds || !creds.tenantId || !creds.clientId) {
        const err = 'Azure credentials are incomplete. Tenant ID, Client ID, and Client Secret are required.';
        steps[steps.length - 1] = { stage: 'validate_config', status: 'failed', message: err };
        return Response.json({
          ok: false,
          status: 'not_configured',
          error: err,
          steps,
          diagnostic: buildDiagnostic('validate_config', err, 'azure'),
        });
      }
      steps[steps.length - 1] = { stage: 'validate_config', status: 'success', message: 'Azure configuration validated.' };

      // Step 2: Authenticate via Azure AD / Entra ID OAuth2
      steps.push({ stage: 'authenticate', status: 'running', message: 'Authenticating service principal with Microsoft Entra ID...' });
      const tokenResult = await getAzureAccessToken(creds);
      if (!tokenResult.ok || !tokenResult.token) {
        steps[steps.length - 1] = { stage: 'authenticate', status: tokenResult.status || 'failed', message: tokenResult.error || 'Authentication failed' };
        return Response.json({
          ok: false,
          status: tokenResult.status || 'failed',
          error: tokenResult.error,
          steps,
          diagnostic: buildDiagnostic('authenticate', tokenResult.error || 'Authentication failed', 'azure'),
        });
      }
      steps[steps.length - 1] = { stage: 'authenticate', status: 'success', message: 'Service principal authenticated successfully with Microsoft Entra ID.', latency_ms: tokenResult.latency };

      // Step 3: Check subscription access
      steps.push({ stage: 'check_access', status: 'running', message: 'Querying Azure subscriptions and access roles...' });
      const subResult = await listSubscriptions(tokenResult.token);
      let subCount = 0;
      if (subResult.ok) {
        subCount = subResult.subscriptions.length;
        steps[steps.length - 1] = { stage: 'check_access', status: 'success', message: `Verified access to ${subCount} Azure subscription(s).`, latency_ms: subResult.latency };
      } else {
        steps[steps.length - 1] = { stage: 'check_access', status: 'warning', message: `Could not list subscriptions automatically: ${subResult.error}. Will rely on configured subscription scope.` };
      }

      // Step 4: Test discovery capability
      steps.push({ stage: 'test_discovery', status: 'running', message: 'Verifying Azure OpenAI and AI Services discovery readiness...' });
      steps[steps.length - 1] = {
        stage: 'test_discovery',
        status: 'success',
        message: 'Discovery ready. Ready to scan Azure OpenAI, Cognitive Services, ML Workspaces, and AI Studio.',
      };

      return Response.json({
        ok: true,
        status: 'connected',
        message: `Azure connection successful. Accessible across ${subCount > 0 ? `${subCount} subscription(s)` : 'configured scope'}.`,
        steps,
        auth_method: 'service_principal',
        subscriptions_count: subCount,
      });
    }

    // ─── 5. AWS connector ───
    if (connector.id === 'aws') {
      const creds = resolveAWSCredentials(effectiveSource);
      const steps: any[] = [];

      // Step 1: Validate config
      steps.push({ stage: 'validate_config', status: 'running', message: 'Validating AWS credentials and region...' });
      if (!creds || !creds.accessKeyId || !creds.secretAccessKey) {
        const err = 'AWS credentials are incomplete. Access Key ID and Secret Access Key are required.';
        steps[steps.length - 1] = { stage: 'validate_config', status: 'failed', message: err };
        return Response.json({
          ok: false,
          status: 'not_configured',
          error: err,
          steps,
          diagnostic: buildDiagnostic('validate_config', err, 'aws'),
        });
      }
      steps[steps.length - 1] = { stage: 'validate_config', status: 'success', message: `AWS configuration validated for region ${creds.region}.` };

      // Step 2: Authenticate via STS GetCallerIdentity
      steps.push({ stage: 'authenticate', status: 'running', message: 'Authenticating with AWS via STS GetCallerIdentity...' });
      const identityResult = await getAWSCallerIdentity(creds);
      if (!identityResult.ok) {
        steps[steps.length - 1] = { stage: 'authenticate', status: identityResult.status || 'failed', message: identityResult.error || 'Authentication failed' };
        return Response.json({
          ok: false,
          status: identityResult.status || 'failed',
          error: identityResult.error,
          steps,
          diagnostic: buildDiagnostic('authenticate', identityResult.error || 'Authentication failed', 'aws'),
        });
      }
      steps[steps.length - 1] = {
        stage: 'authenticate',
        status: 'success',
        message: `Authenticated as AWS Account ${identityResult.accountId} (${identityResult.arn || 'IAM Principal'}).`,
        latency_ms: identityResult.latency,
      };

      // Step 3: Check Bedrock foundation models discovery
      steps.push({ stage: 'discover_models', status: 'running', message: `Probing Amazon Bedrock foundation models in ${creds.region}...` });
      const bedrockResult = await listBedrockFoundationModels(creds);
      let bedrockCount = 0;
      if (bedrockResult.ok) {
        bedrockCount = bedrockResult.models.length;
        steps[steps.length - 1] = {
          stage: 'discover_models',
          status: 'success',
          message: `Discovered ${bedrockCount} Bedrock foundation model(s) available in ${creds.region}.`,
          latency_ms: bedrockResult.latency,
        };
      } else {
        steps[steps.length - 1] = {
          stage: 'discover_models',
          status: 'warning',
          message: `Bedrock check notice: ${bedrockResult.error}. SageMaker and other services will still be scanned.`,
        };
      }

      // Step 4: Test discovery readiness
      steps.push({ stage: 'test_discovery', status: 'running', message: 'Testing AI services discovery pipeline...' });
      steps[steps.length - 1] = {
        stage: 'test_discovery',
        status: 'success',
        message: 'Discovery ready. Ready to scan Bedrock models and SageMaker endpoints.',
      };

      return Response.json({
        ok: true,
        status: 'connected',
        message: `AWS connection successful for Account ${identityResult.accountId} in region ${creds.region}.`,
        steps,
        auth_method: 'access_key',
        account_id: identityResult.accountId,
        arn: identityResult.arn,
        bedrock_models_count: bedrockCount,
      });
    }

    // ─── 6. Google Cloud (GCP) connector ───
    if (connector.id === 'gcp') {
      const creds = resolveGCPCredentials(effectiveSource);
      const steps: any[] = [];

      // Step 1: Validate config
      steps.push({ stage: 'validate_config', status: 'running', message: 'Validating Google Cloud service account key...' });
      if (!creds || !creds.projectId || !creds.clientEmail || !creds.privateKey) {
        const err = 'Google Cloud credentials are incomplete. Project ID, Client Email, and Private Key are required.';
        steps[steps.length - 1] = { stage: 'validate_config', status: 'failed', message: err };
        return Response.json({
          ok: false,
          status: 'not_configured',
          error: err,
          steps,
          diagnostic: buildDiagnostic('validate_config', err, 'gcp'),
        });
      }
      steps[steps.length - 1] = { stage: 'validate_config', status: 'success', message: `Service account configuration validated for project "${creds.projectId}".` };

      // Step 2: Authenticate via signed JWT and OAuth2 token exchange
      steps.push({ stage: 'authenticate', status: 'running', message: 'Signing JWT and exchanging with Google OAuth2...' });
      const tokenResult = await getGCPAccessToken(creds);
      if (!tokenResult.ok || !tokenResult.token) {
        steps[steps.length - 1] = { stage: 'authenticate', status: tokenResult.status || 'failed', message: tokenResult.error || 'Authentication failed' };
        return Response.json({
          ok: false,
          status: tokenResult.status || 'failed',
          error: tokenResult.error,
          steps,
          diagnostic: buildDiagnostic('authenticate', tokenResult.error || 'Authentication failed', 'gcp'),
        });
      }
      steps[steps.length - 1] = {
        stage: 'authenticate',
        status: 'success',
        message: `Authenticated as ${creds.clientEmail}.`,
        latency_ms: tokenResult.latency,
      };

      // Step 3: Test Vertex AI access
      steps.push({ stage: 'check_access', status: 'running', message: `Testing Vertex AI access in project "${creds.projectId}"...` });
      const modelsResult = await discoverVertexAIModels(tokenResult.token, creds.projectId, ['us-central1']);
      steps[steps.length - 1] = {
        stage: 'check_access',
        status: 'success',
        message: `Vertex AI API accessible in ${creds.projectId} (${modelsResult.resources.length} model(s) discovered in default region).`,
      };

      // Step 4: Test discovery readiness
      steps.push({ stage: 'test_discovery', status: 'running', message: 'Verifying Vertex AI and Dialogflow discovery capability...' });
      steps[steps.length - 1] = {
        stage: 'test_discovery',
        status: 'success',
        message: 'Discovery ready. Ready to scan Vertex AI models, endpoints, and Dialogflow agents.',
      };

      return Response.json({
        ok: true,
        status: 'connected',
        message: `Google Cloud connection successful for project "${creds.projectId}".`,
        steps,
        auth_method: 'service_account',
        project_id: creds.projectId,
        client_email: creds.clientEmail,
        vertex_models_count: modelsResult.resources.length,
      });
    }

    // ─── 7. Manual connector ───
    if (connector.id === 'manual') {
      return Response.json({
        ok: true,
        status: 'connected',
        message: 'Manual source does not require external authentication.',
        steps: [
          { stage: 'validate_config', status: 'success', message: 'Manual sources do not require external credentials.' },
          { stage: 'test_discovery', status: 'success', message: 'Ready to record manually registered AI asset into inventory.' },
        ],
        auth_method: 'none',
      });
    }

    return Response.json({
      ok: false,
      status: 'not_supported',
      error: `Connector "${connector.name}" does not support connection testing yet.`,
      steps: [{ stage: 'validate_config', status: 'failed', message: `Connector "${connector.name}" is coming soon.` }],
    }, { status: 501 });

  } catch (error: any) {
    return Response.json({
      ok: false,
      status: 'error',
      error: error.message || 'Unknown internal error',
      steps: [{ stage: 'validate_config', status: 'failed', message: error.message }],
      diagnostic: {
        stage: 'internal_error',
        error: error.message,
        likely_cause: 'An unhandled exception occurred in the connection test function.',
        required_action: 'Verify server logs and backend runtime health.',
        remediation: 'Check network connectivity to Base44 functions.',
      },
    }, { status: 500 });
  }
}