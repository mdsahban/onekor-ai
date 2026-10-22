import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { getConnector } from '../../shared/connectors.ts';
import {
  getAuthenticatedUser, listOrganizations, listRepositories,
  listInstallations, getInstallationToken, listInstallationRepositories,
} from '../../shared/github-client.ts';
import {
  validateApiKey as validateOpenAIKey, getAccountInfo as getOpenAIAccountInfo,
  listModels as listOpenAIModels,
} from '../../shared/openai-client.ts';
import {
  validateApiKey as validateAnthropicKey, getAccountInfo as getAnthropicAccountInfo,
  listModels as listAnthropicModels,
} from '../../shared/anthropic-client.ts';
import {
  getAzureAccessToken, listSubscriptions, resolveAzureCredentials,
} from '../../shared/azure-client.ts';
import {
  getAWSCallerIdentity, resolveAWSCredentials,
} from '../../shared/aws-client.ts';
import {
  getGCPAccessToken, listVertexAIRegions, resolveGCPCredentials,
} from '../../shared/gcp-client.ts';

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { connectorId, action } = body;

    // Resolve properties with fallbacks for naming conventions
    const token = (body.token || body._token || body.config?.token || body.config?._token || '').toString().trim();
    const appId = (body.appId || body._app_id || body.config?.appId || body.config?._app_id || '').toString().trim();
    const privateKey = (body.privateKey || body._private_key || body.config?.privateKey || body.config?._private_key || '').toString().trim();
    const installationId = (body.installationId || body._installation_id || body.config?.installationId || body.config?._installation_id || '').toString().trim();
    const apiKey = (body.apiKey || body._api_key || body.config?.apiKey || body.config?._api_key || '').toString().trim();
    const organization = (body.organization || body.orgId || body.config?.organization || '').toString().trim();
    const project = (body.project || body.config?.project || '').toString().trim();

    // ─── OpenAI connector ───
    if (connectorId === 'openai') {
      if (action === 'validate_api_key') {
        if (!apiKey || apiKey.length < 10) {
          return Response.json({ ok: false, status: 'authentication_failed', error: 'The API key appears to be empty or too short.' });
        }
        const accountResult = await getOpenAIAccountInfo(apiKey, organization, project);
        if (!accountResult.ok) {
          return Response.json({ ok: false, status: accountResult.status, error: accountResult.error });
        }
        return Response.json({
          ok: true,
          status: 'connected',
          account: accountResult.account,
          models: accountResult.models,
          model_count: accountResult.account.model_count,
        });
      }

      if (action === 'get_models') {
        if (!apiKey) {
          return Response.json({ ok: false, status: 'authentication_failed', error: 'API key is required.' });
        }
        const modelsResult = await listOpenAIModels(apiKey, organization, project);
        if (!modelsResult.ok) {
          return Response.json({ ok: false, status: modelsResult.status, error: modelsResult.error });
        }
        return Response.json({
          ok: true,
          status: 'connected',
          models: modelsResult.models,
          organizations: modelsResult.organizations,
          model_count: modelsResult.model_count,
        });
      }

      return Response.json({ error: `Unknown OpenAI action: ${action}` }, { status: 400 });
    }

    // ─── Anthropic connector ───
    if (connectorId === 'anthropic') {
      if (action === 'validate_api_key') {
        if (!apiKey || apiKey.length < 10) {
          return Response.json({ ok: false, status: 'authentication_failed', error: 'The API key appears to be empty or too short.' });
        }
        const accountResult = await getAnthropicAccountInfo(apiKey);
        if (!accountResult.ok) {
          return Response.json({ ok: false, status: accountResult.status, error: accountResult.error });
        }
        return Response.json({
          ok: true,
          status: 'connected',
          account: accountResult.account,
          models: accountResult.models,
          model_count: accountResult.account.model_count,
        });
      }

      if (action === 'get_models') {
        if (!apiKey) {
          return Response.json({ ok: false, status: 'authentication_failed', error: 'API key is required.' });
        }
        const modelsResult = await listAnthropicModels(apiKey);
        if (!modelsResult.ok) {
          return Response.json({ ok: false, status: modelsResult.status, error: modelsResult.error });
        }
        return Response.json({
          ok: true,
          status: 'connected',
          models: modelsResult.models,
          model_count: modelsResult.model_count,
        });
      }

      return Response.json({ error: `Unknown Anthropic action: ${action}` }, { status: 400 });
    }

    if (connectorId !== 'github') {
      return Response.json({ error: `Connector "${connectorId}" is not supported for validation.` }, { status: 400 });
    }

    // ─── Action: validate PAT ───
    if (action === 'validate_pat') {
      if (!token || token.length < 10) {
        return Response.json({ ok: false, status: 'authentication_failed', error: 'The token appears to be empty or too short.' });
      }
      const userResult = await getAuthenticatedUser(token);
      if (!userResult.ok) {
        return Response.json({ ok: false, status: userResult.status, error: userResult.error });
      }
      const orgResult = await listOrganizations(token);
      return Response.json({
        ok: true,
        status: 'connected',
        user: {
          login: userResult.user.login,
          name: userResult.user.name,
          avatar_url: userResult.user.avatar_url,
          type: userResult.user.type,
        },
        organizations: orgResult.ok ? orgResult.orgs : [],
      });
    }

    // ─── Action: validate GitHub App ───
    if (action === 'validate_app') {
      if (!appId || !privateKey) {
        return Response.json({ ok: false, status: 'authentication_failed', error: 'App ID and private key are required.' });
      }
      const instResult = await listInstallations(appId, privateKey);
      if (!instResult.ok) {
        return Response.json({ ok: false, status: instResult.status, error: instResult.error });
      }
      return Response.json({
        ok: true,
        status: 'connected',
        installations: instResult.installations,
      });
    }

    // ─── Action: get installation repositories ───
    if (action === 'get_installation_repos') {
      if (!appId || !privateKey || !installationId) {
        return Response.json({ ok: false, status: 'authentication_failed', error: 'App ID, private key, and installation ID are required.' });
      }
      const tokenResult = await getInstallationToken(appId, privateKey, parseInt(installationId, 10));
      if (!tokenResult.ok) {
        return Response.json({ ok: false, status: tokenResult.status, error: tokenResult.error });
      }
      const reposResult = await listInstallationRepositories(tokenResult.token);
      if (!reposResult.ok) {
        return Response.json({ ok: false, status: reposResult.status, error: reposResult.error });
      }
      return Response.json({
        ok: true,
        status: 'connected',
        repositories: reposResult.repos,
        total_count: reposResult.total_count,
        permissions: tokenResult.permissions,
      });
    }

    // ─── Action: get repositories (PAT) ───
    if (action === 'get_repos') {
      if (!token) {
        return Response.json({ ok: false, status: 'authentication_failed', error: 'Token is required.' });
      }
      const repoResult = await listRepositories(token, organization);
      if (!repoResult.ok) {
        return Response.json({ ok: false, status: repoResult.status, error: repoResult.error });
      }
      return Response.json({
        ok: true,
        status: 'connected',
        repositories: repoResult.repos,
      });
    }

    // ─── Cloud connectors validation ───
    const effectiveCloudSource = {
      id: 'validate',
      config: {
        ...(body.config || {}),
        ...(body.tenantId ? { _tenant_id: body.tenantId, tenantId: body.tenantId } : {}),
        ...(body.clientId ? { _client_id: body.clientId, clientId: body.clientId } : {}),
        ...(body.clientSecret ? { _client_secret: body.clientSecret, clientSecret: body.clientSecret } : {}),
        ...(body.subscriptionIds ? { subscription_ids: body.subscriptionIds } : {}),
        ...(body.accessKeyId ? { _access_key_id: body.accessKeyId, accessKeyId: body.accessKeyId } : {}),
        ...(body.secretAccessKey ? { _secret_access_key: body.secretAccessKey, secretAccessKey: body.secretAccessKey } : {}),
        ...(body.sessionToken ? { _session_token: body.sessionToken, sessionToken: body.sessionToken } : {}),
        ...(body.region ? { region: body.region } : {}),
        ...(body.projectId ? { project_id: body.projectId, projectId: body.projectId } : {}),
        ...(body.clientEmail ? { _client_email: body.clientEmail, clientEmail: body.clientEmail } : {}),
        ...(body.privateKey ? { _private_key: body.privateKey, privateKey: body.privateKey } : {}),
        ...(body.serviceAccountJson ? { _service_account_json: body.serviceAccountJson, serviceAccountJson: body.serviceAccountJson } : {}),
      },
    };

    if (connectorId === 'azure') {
      const creds = resolveAzureCredentials(effectiveCloudSource);
      if (!creds) return Response.json({ ok: false, status: 'not_configured', error: 'Azure credentials are incomplete.' });
      const tokenResult = await getAzureAccessToken(creds);
      if (!tokenResult.ok || !tokenResult.token) return Response.json({ ok: false, status: tokenResult.status || 'failed', error: tokenResult.error });

      if (action === 'get_subscriptions' || action === 'validate_credentials') {
        const subResult = await listSubscriptions(tokenResult.token);
        return Response.json({
          ok: true,
          status: 'connected',
          subscriptions: subResult.subscriptions || [],
        });
      }
    }

    if (connectorId === 'aws') {
      const creds = resolveAWSCredentials(effectiveCloudSource);
      if (!creds) return Response.json({ ok: false, status: 'not_configured', error: 'AWS credentials are incomplete.' });
      const identityResult = await getAWSCallerIdentity(creds);
      if (!identityResult.ok) return Response.json({ ok: false, status: identityResult.status || 'failed', error: identityResult.error });
      return Response.json({
        ok: true,
        status: 'connected',
        accountId: identityResult.accountId,
        arn: identityResult.arn,
      });
    }

    if (connectorId === 'gcp') {
      const creds = resolveGCPCredentials(effectiveCloudSource);
      if (!creds) return Response.json({ ok: false, status: 'not_configured', error: 'GCP credentials are incomplete.' });
      const tokenResult = await getGCPAccessToken(creds);
      if (!tokenResult.ok || !tokenResult.token) return Response.json({ ok: false, status: tokenResult.status || 'failed', error: tokenResult.error });
      const regions = await listVertexAIRegions(tokenResult.token, creds.projectId);
      return Response.json({
        ok: true,
        status: 'connected',
        clientEmail: creds.clientEmail,
        projectId: creds.projectId,
        regions,
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}