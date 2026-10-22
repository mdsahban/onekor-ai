import { useState, useMemo, useCallback } from 'react';
import { useNav } from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { pathFor } from '@/lib/navigation';
import { getConnector } from '@/lib/discovery/connectors';
import {
  useDiscoverySources, useCreateSource, useUpdateSource,
  useTestConnection, useCreateAuditEvent, useSourceLogs,
} from '@/lib/discovery/hooks';
import { CONNECTION_STATUS_META, LOG_SEVERITY_META, formatDateTime, formatRelative } from '@/lib/discovery/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import DiagnosticCard from '@/components/discovery/DiagnosticCard';
import {
  ArrowLeft, Plug, Check, AlertCircle, Loader2, KeyRound, Info, RefreshCw,
  Database, Activity, Shield, ChevronRight, ExternalLink,
  Search, CheckCircle2, XCircle, Clock, Github,
} from 'lucide-react';

// ─── Tabs ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'connection', label: 'Connection', icon: Plug },
  { id: 'metadata', label: 'Metadata', icon: Database },
  { id: 'logs', label: 'Logs', icon: Activity },
];

// ─── Status Pills ────────────────────────────────────────────────────
function ConnectionStatusPill({ status }) {
  const meta = CONNECTION_STATUS_META[status] || CONNECTION_STATUS_META['not_configured'];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', meta.bg, meta.color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

function ConnectorStatusBadge({ status }) {
  if (status === 'available') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Available
    </span>
  );
  if (status === 'beta') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Beta
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      Coming Soon
    </span>
  );
}

// ─── Tab: Connection ─────────────────────────────────────────────────
function ConnectionTab({ connector, source, onSourceSaved }) {
  const isAvailable = connector.status === 'available' || connector.status === 'beta';
  const createSource = useCreateSource();
  const updateSource = useUpdateSource();
  const testConnection = useTestConnection();
  const createAudit = useCreateAuditEvent();

  const isEdit = !!source;
  const isManual = connector.id === 'manual';
  const isGitHub = connector.id === 'github';
  const isAiPlatform = connector.id === 'openai' || connector.id === 'anthropic';
  const isAzure = connector.id === 'azure';
  const isAWS = connector.id === 'aws';
  const isGCP = connector.id === 'gcp';
  const isCloud = isAzure || isAWS || isGCP;

  // State
  const [authMethod, setAuthMethod] = useState(() => source?.config?.auth_method || source?.config?.authMethod || (isAzure ? 'service_principal' : isAWS ? 'access_key' : isGCP ? 'service_account' : isAiPlatform ? 'api_key' : 'pat'));
  const [name, setName] = useState(source?.name || '');
  const [description, setDescription] = useState(source?.config?.description || '');
  const [environment, setEnvironment] = useState(source?.config?.environment || 'production');
  const [token, setToken] = useState('');
  const [appId, setAppId] = useState(source?.config?._app_id || source?.config?.appId || '');
  const [privateKey, setPrivateKey] = useState(source?.config?._private_key || source?.config?.privateKey || '');
  const [installationId, setInstallationId] = useState(source?.config?._installation_id || source?.config?.installationId || '');
  const [apiKey, setApiKey] = useState('');
  const [organization, setOrganization] = useState(source?.config?.organization || '');
  const [project, setProject] = useState(source?.config?.project || '');

  // Cloud states
  const [tenantId, setTenantId] = useState(() => source?.config?._tenant_id || source?.config?.tenantId || source?.config?.tenant_id || '');
  const [clientId, setClientId] = useState(() => source?.config?._client_id || source?.config?.clientId || source?.config?.client_id || '');
  const [clientSecret, setClientSecret] = useState('');
  const [subscriptionIds, setSubscriptionIds] = useState(() => {
    const subs = source?.config?.subscription_ids || source?.config?.subscriptionIds;
    return Array.isArray(subs) ? subs.join(', ') : (subs || '');
  });

  const [accessKeyId, setAccessKeyId] = useState(() => source?.config?._access_key_id || source?.config?.accessKeyId || source?.config?.access_key_id || '');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [region, setRegion] = useState(() => source?.config?.region || 'us-east-1');
  const [sessionToken, setSessionToken] = useState(() => source?.config?._session_token || source?.config?.sessionToken || '');

  const [gcpAuthMode, setGcpAuthMode] = useState('json');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [projectId, setProjectId] = useState(() => source?.config?.project_id || source?.config?.projectId || '');
  const [clientEmail, setClientEmail] = useState(() => source?.config?._client_email || source?.config?.clientEmail || source?.config?.client_email || '');
  const [gcpPrivateKey, setGcpPrivateKey] = useState('');

  const [frequency, setFrequency] = useState(source?.scan_frequency || 'manual');
  const [enabled, setEnabled] = useState(source?.enabled !== false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check for saved credentials in existing source
  const hasExistingToken = !!(source?.config?._token || source?.config?.token);
  const hasExistingApiKey = !!(source?.config?._api_key || source?.config?.apiKey);
  const hasExistingApp = !!((source?.config?._app_id || source?.config?.appId) && (source?.config?._private_key || source?.config?.privateKey) && (source?.config?._installation_id || source?.config?.installationId));
  const hasExistingAzureSecret = !!(source?.config?._client_secret || source?.config?.clientSecret || source?.config?.client_secret);
  const hasExistingAWSSecret = !!(source?.config?._secret_access_key || source?.config?.secretAccessKey || source?.config?.secret_access_key);
  const hasExistingGCPSecret = !!(source?.config?._service_account_json || source?.config?.serviceAccountJson || source?.config?._private_key || source?.config?.privateKey);

  const hasCredential = isGitHub
    ? (authMethod === 'pat' ? (!!token.trim() || hasExistingToken) : ((!!appId.trim() && !!privateKey.trim() && !!installationId) || hasExistingApp))
    : isAiPlatform
      ? (!!apiKey.trim() || hasExistingApiKey)
      : isAzure
        ? (!!tenantId.trim() && !!clientId.trim() && (!!clientSecret.trim() || hasExistingAzureSecret))
        : isAWS
          ? (!!accessKeyId.trim() && (!!secretAccessKey.trim() || hasExistingAWSSecret))
          : isGCP
            ? ((!!serviceAccountJson.trim() || (!!projectId.trim() && !!clientEmail.trim() && !!gcpPrivateKey.trim())) || hasExistingGCPSecret)
            : true;

  const hasName = name.trim().length >= 2;
  const canSave = hasName && (isManual || !isAvailable || hasCredential);

  const buildConfig = useCallback(() => {
    const base = {
      description: description || undefined,
      environment,
      organization: organization || undefined,
      auth_method: authMethod,
      authMethod: authMethod,
      // Retain existing scope settings if already present
      repositories: source?.config?.repositories || [],
      repository_mode: source?.config?.repository_mode || 'all',
      branch: source?.config?.branch || undefined,
      path_filter: source?.config?.path_filter || undefined,
      exclude_repos: source?.config?.exclude_repos || [],
      discovery_categories: source?.config?.discovery_categories || {},
    };

    if (isGitHub) {
      if (authMethod === 'pat') {
        const resolvedToken = token.trim() || source?.config?._token || source?.config?.token;
        if (resolvedToken) {
          base._token = resolvedToken;
          base.token = resolvedToken;
        }
      } else if (authMethod === 'github_app') {
        const resolvedAppId = appId.trim() || source?.config?._app_id || source?.config?.appId;
        const resolvedKey = privateKey.trim() || source?.config?._private_key || source?.config?.privateKey;
        const resolvedInst = installationId.trim() || source?.config?._installation_id || source?.config?.installationId;
        if (resolvedAppId) { base._app_id = resolvedAppId; base.appId = resolvedAppId; }
        if (resolvedKey) { base._private_key = resolvedKey; base.privateKey = resolvedKey; }
        if (resolvedInst) { base._installation_id = resolvedInst; base.installationId = resolvedInst; }
      }
    }

    if (isAiPlatform) {
      base.auth_method = 'api_key';
      base.authMethod = 'api_key';
      const resolvedKey = apiKey.trim() || source?.config?._api_key || source?.config?.apiKey;
      if (resolvedKey) {
        base._api_key = resolvedKey;
        base.apiKey = resolvedKey;
      }
      if (connector.id === 'openai' && project) base.project = project;
    }

    if (isAzure) {
      base.auth_method = 'service_principal';
      base.authMethod = 'service_principal';
      base._tenant_id = tenantId.trim();
      base.tenantId = tenantId.trim();
      base.tenant_id = tenantId.trim();
      base._client_id = clientId.trim();
      base.clientId = clientId.trim();
      base.client_id = clientId.trim();
      const resolvedSecret = clientSecret.trim() || source?.config?._client_secret || source?.config?.clientSecret || source?.config?.client_secret;
      if (resolvedSecret) {
        base._client_secret = resolvedSecret;
        base.clientSecret = resolvedSecret;
        base.client_secret = resolvedSecret;
      }
      if (subscriptionIds.trim()) {
        base.subscription_ids = subscriptionIds.split(',').map((s) => s.trim()).filter(Boolean);
        base.subscriptionIds = base.subscription_ids;
      }
    }

    if (isAWS) {
      base.auth_method = 'access_key';
      base.authMethod = 'access_key';
      base._access_key_id = accessKeyId.trim();
      base.accessKeyId = accessKeyId.trim();
      base.access_key_id = accessKeyId.trim();
      const resolvedSecret = secretAccessKey.trim() || source?.config?._secret_access_key || source?.config?.secretAccessKey || source?.config?.secret_access_key;
      if (resolvedSecret) {
        base._secret_access_key = resolvedSecret;
        base.secretAccessKey = resolvedSecret;
        base.secret_access_key = resolvedSecret;
      }
      base.region = region || 'us-east-1';
      if (sessionToken.trim()) {
        base._session_token = sessionToken.trim();
        base.sessionToken = sessionToken.trim();
      }
    }

    if (isGCP) {
      base.auth_method = 'service_account';
      base.authMethod = 'service_account';
      if (serviceAccountJson.trim()) {
        base._service_account_json = serviceAccountJson.trim();
        base.serviceAccountJson = serviceAccountJson.trim();
        try {
          const parsed = JSON.parse(serviceAccountJson.trim());
          if (parsed.project_id) { base.project_id = parsed.project_id; base.projectId = parsed.project_id; }
          if (parsed.client_email) { base._client_email = parsed.client_email; base.clientEmail = parsed.client_email; }
          if (parsed.private_key) { base._private_key = parsed.private_key; base.privateKey = parsed.private_key; }
        } catch { /* use as raw string */ }
      } else {
        const resolvedJson = source?.config?._service_account_json || source?.config?.serviceAccountJson;
        if (resolvedJson) {
          base._service_account_json = resolvedJson;
          base.serviceAccountJson = resolvedJson;
        }
        if (projectId.trim()) { base.project_id = projectId.trim(); base.projectId = projectId.trim(); }
        if (clientEmail.trim()) { base._client_email = clientEmail.trim(); base.clientEmail = clientEmail.trim(); }
        const resolvedKey = gcpPrivateKey.trim() || source?.config?._private_key || source?.config?.privateKey;
        if (resolvedKey) { base._private_key = resolvedKey; base.privateKey = resolvedKey; }
      }
    }

    return base;
  }, [
    description, environment, organization, token, apiKey, project, isGitHub, isAiPlatform, isAzure, isAWS, isGCP,
    connector.id, authMethod, appId, privateKey, installationId, source,
    tenantId, clientId, clientSecret, subscriptionIds, accessKeyId, secretAccessKey, region, sessionToken,
    serviceAccountJson, projectId, clientEmail, gcpPrivateKey,
  ]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const config = buildConfig();
      const payload = {
        sourceId: source?.id,
        connectorId: connector.id,
        authMethod: isGitHub ? authMethod : (isAiPlatform ? 'api_key' : isAzure ? 'service_principal' : isAWS ? 'access_key' : isGCP ? 'service_account' : 'none'),
        token: token.trim() || source?.config?._token || source?.config?.token || undefined,
        appId: appId.trim() || source?.config?._app_id || source?.config?.appId || undefined,
        privateKey: privateKey.trim() || source?.config?._private_key || source?.config?.privateKey || undefined,
        installationId: installationId.trim() || source?.config?._installation_id || source?.config?.installationId || undefined,
        apiKey: apiKey.trim() || source?.config?._api_key || source?.config?.apiKey || undefined,
        organization: organization.trim() || undefined,
        project: project.trim() || undefined,
        // Cloud credentials
        tenantId: tenantId.trim() || source?.config?._tenant_id || source?.config?.tenantId || undefined,
        clientId: clientId.trim() || source?.config?._client_id || source?.config?.clientId || undefined,
        clientSecret: clientSecret.trim() || source?.config?._client_secret || source?.config?.clientSecret || undefined,
        subscriptionIds: subscriptionIds.trim() ? subscriptionIds.split(',').map((s) => s.trim()).filter(Boolean) : (source?.config?.subscription_ids || undefined),
        accessKeyId: accessKeyId.trim() || source?.config?._access_key_id || source?.config?.accessKeyId || undefined,
        secretAccessKey: secretAccessKey.trim() || source?.config?._secret_access_key || source?.config?.secretAccessKey || undefined,
        region: region || source?.config?.region || undefined,
        sessionToken: sessionToken.trim() || source?.config?._session_token || source?.config?.sessionToken || undefined,
        projectId: projectId.trim() || source?.config?.project_id || source?.config?.projectId || undefined,
        clientEmail: clientEmail.trim() || source?.config?._client_email || source?.config?.clientEmail || undefined,
        gcpPrivateKey: gcpPrivateKey.trim() || source?.config?._private_key || source?.config?.privateKey || undefined,
        serviceAccountJson: serviceAccountJson.trim() || source?.config?._service_account_json || source?.config?.serviceAccountJson || undefined,
        config,
      };
      const result = await testConnection.mutateAsync(payload);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        status: 'error',
        error: err.message || 'Connection test failed',
        steps: [{ stage: 'authenticate', status: 'failed', message: err.message || 'Connection test failed' }],
      });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config = buildConfig();
      const data = {
        name: name.trim(),
        connector_id: connector.id,
        status: 'active',
        connection_status: testResult?.ok ? 'connected' : (source?.connection_status === 'connected' ? 'connected' : (isManual ? 'connected' : 'not_configured')),
        config,
        credential_reference: (isGitHub || isAiPlatform) ? 'inline' : (connector.credentialSecret || null),
        scan_frequency: frequency,
        enabled,
      };
      let saved;
      if (isEdit) {
        saved = await updateSource.mutateAsync({ id: source.id, data });
        await createAudit.mutateAsync({ action: 'source_updated', resource_type: 'discovery_source', resource_id: source.id, result: 'success', details: { name: data.name } });
      } else {
        saved = await createSource.mutateAsync(data);
        await createAudit.mutateAsync({ action: 'source_created', resource_type: 'discovery_source', resource_id: saved.id, result: 'success', details: { name: data.name, connector_id: connector.id } });
      }
      onSourceSaved(saved);
    } catch (_err) {
      // mutation handles errors
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* About card */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-foreground">About this Connector</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{connector.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{connector.categoryLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Authentication</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{connector.authLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-0.5"><ConnectorStatusBadge status={connector.status} /></div>
          </div>
        </div>
        {connector.capabilityLabels?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Discovers</p>
            <div className="flex flex-wrap gap-1.5">
              {connector.capabilityLabels.map((cap) => (
                <span key={cap} className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Coming Soon */}
      {!isAvailable && (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Clock className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground">Coming Soon</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            The {connector.name} connector is in development and will be available in a future release.
          </p>
        </div>
      )}

      {/* Available connectors — config form */}
      {isAvailable && (
        <>
          {/* Saved credential banner if reopening existing source */}
          {isEdit && (hasExistingToken || hasExistingApiKey || hasExistingApp || hasExistingAzureSecret || hasExistingAWSSecret || hasExistingGCPSecret) && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex gap-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-emerald-950 dark:text-emerald-200">
                    Existing Credentials Configured
                  </p>
                  <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">
                    Your credentials are saved securely. You can test the connection or adjust settings without re-entering secrets. Leave the secret field blank to keep your current credentials.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Credential notice for new setup */}
          {!isEdit && (isGitHub || isAiPlatform || isCloud) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex gap-3">
                <KeyRound className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    {isGitHub ? 'GitHub Authentication' : isAiPlatform ? `${connector.name} API Key` : `${connector.name} Authentication`}
                  </p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-300">{connector.credentialHelp}</p>
                </div>
              </div>
            </div>
          )}

          {/* Source name */}
          <div className="space-y-2">
            <Label htmlFor="src-name">Source Name *</Label>
            <Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`My ${connector.name} Source`} />
            <p className="text-xs text-muted-foreground">A friendly name to identify this AI Source in your inventory.</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="src-desc">Description</Label>
            <Textarea id="src-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What AI assets will this source discover?" rows={2} />
          </div>

          {/* GitHub Authentication Method & Fields */}
          {isGitHub && (
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Authentication Method *
                </Label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('pat')}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all',
                      authMethod === 'pat'
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    <KeyRound className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Personal Access Token</p>
                      <p className="text-[10px] text-muted-foreground">Classic or fine-grained token</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMethod('github_app')}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all',
                      authMethod === 'github_app'
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    <Github className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">GitHub App</p>
                      <p className="text-[10px] text-muted-foreground">Higher limits, enterprise orgs</p>
                    </div>
                  </button>
                </div>
              </div>

              {authMethod === 'pat' && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gh-token">Personal Access Token *</Label>
                    {hasExistingToken && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        • Current token saved
                      </span>
                    )}
                  </div>
                  <Input
                    id="gh-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={hasExistingToken ? '•••••••••••••••• (Leave blank to keep saved token)' : 'ghp_... or github_pat_...'}
                    autoComplete="off"
                  />
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Requires <code className="rounded bg-muted px-1 py-0.5 font-mono">repo</code> scope for private repos. For fine-grained tokens: <em>Contents: Read</em>.{' '}
                      <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                        Create token <ExternalLink className="h-3 w-3" />
                      </a>
                    </span>
                  </div>
                </div>
              )}

              {authMethod === 'github_app' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="gh-appid">App ID *</Label>
                      <Input
                        id="gh-appid"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        placeholder="e.g. 123456"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gh-instid">Installation ID *</Label>
                      <Input
                        id="gh-instid"
                        value={installationId}
                        onChange={(e) => setInstallationId(e.target.value)}
                        placeholder="e.g. 98765432"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="gh-privkey">Private Key (PEM format) *</Label>
                      {source?.config?._private_key && (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          • Private key saved
                        </span>
                      )}
                    </div>
                    <Textarea
                      id="gh-privkey"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder={source?.config?._private_key ? '•••••••••••••••• (Leave blank to keep saved key)' : '-----BEGIN RSA PRIVATE KEY-----\n...'}
                      rows={3}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1 border-t border-border/50">
                <Label htmlFor="gh-org">Organization (optional)</Label>
                <Input id="gh-org" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="my-organization" />
                <p className="text-xs text-muted-foreground">Leave empty to scan personal repositories or specify an organization to focus discovery.</p>
              </div>
            </div>
          )}

          {/* AI Platform API Key */}
          {isAiPlatform && (
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-key">API Key *</Label>
                  {hasExistingApiKey && (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      • Current API key saved
                    </span>
                  )}
                </div>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasExistingApiKey ? '•••••••••••••••• (Leave blank to keep saved key)' : (connector.id === 'openai' ? 'sk-proj-...' : 'sk-ant-...')}
                  autoComplete="off"
                />
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Used only to read model metadata. Never stored in plain text.{' '}
                    <a
                      href={connector.id === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://console.anthropic.com/settings/keys'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      Get key <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                </div>
              </div>
              {connector.id === 'openai' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-2">
                    <Label htmlFor="oai-org">Organization (optional)</Label>
                    <Input id="oai-org" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="org-..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oai-proj">Project (optional)</Label>
                    <Input id="oai-proj" value={project} onChange={(e) => setProject(e.target.value)} placeholder="proj_..." />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Azure Service Principal Fields */}
          {isAzure && (
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="az-tenant">Tenant ID (Directory ID) *</Label>
                    <Input
                      id="az-tenant"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="az-client">Application (Client) ID *</Label>
                    <Input
                      id="az-client"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="az-secret">Client Secret *</Label>
                    {hasExistingAzureSecret && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        • Current secret saved
                      </span>
                    )}
                  </div>
                  <Input
                    id="az-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={hasExistingAzureSecret ? '•••••••••••••••• (Leave blank to keep saved secret)' : 'Client secret value'}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="az-subs">Subscription IDs (optional, comma-separated)</Label>
                  <Input
                    id="az-subs"
                    value={subscriptionIds}
                    onChange={(e) => setSubscriptionIds(e.target.value)}
                    placeholder="sub-id-1, sub-id-2 (Leave blank to scan all accessible subscriptions)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ensure your Service Principal has the <strong>Reader</strong> or <strong>Cognitive Services Contributor</strong> role on your subscriptions.{' '}
                    <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                      Azure App Registrations <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AWS Access Key Fields */}
          {isAWS && (
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="aws-key">Access Key ID *</Label>
                    <Input
                      id="aws-key"
                      value={accessKeyId}
                      onChange={(e) => setAccessKeyId(e.target.value)}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="aws-region">Primary Region *</Label>
                    <Select value={region} onValueChange={setRegion}>
                      <SelectTrigger id="aws-region"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us-east-1">us-east-1 (N. Virginia - Bedrock)</SelectItem>
                        <SelectItem value="us-east-2">us-east-2 (Ohio)</SelectItem>
                        <SelectItem value="us-west-2">us-west-2 (Oregon - Bedrock)</SelectItem>
                        <SelectItem value="eu-west-1">eu-west-1 (Ireland - Bedrock)</SelectItem>
                        <SelectItem value="eu-central-1">eu-central-1 (Frankfurt - Bedrock)</SelectItem>
                        <SelectItem value="ap-southeast-1">ap-southeast-1 (Singapore)</SelectItem>
                        <SelectItem value="ap-northeast-1">ap-northeast-1 (Tokyo - Bedrock)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="aws-secret">Secret Access Key *</Label>
                    {hasExistingAWSSecret && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        • Current secret key saved
                      </span>
                    )}
                  </div>
                  <Input
                    id="aws-secret"
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => setSecretAccessKey(e.target.value)}
                    placeholder={hasExistingAWSSecret ? '•••••••••••••••• (Leave blank to keep saved key)' : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="aws-token">Session Token (optional, for temporary credentials)</Label>
                  <Input
                    id="aws-token"
                    type="password"
                    value={sessionToken}
                    onChange={(e) => setSessionToken(e.target.value)}
                    placeholder="Optional STS Session Token"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Requires <code className="rounded bg-muted px-1 py-0.5 font-mono">bedrock:ListFoundationModels</code> and <code className="rounded bg-muted px-1 py-0.5 font-mono">sagemaker:ListEndpoints</code> permissions.{' '}
                    <a href="https://console.aws.amazon.com/iam/home#/security_credentials" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                      AWS IAM Console <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Google Cloud Service Account Fields */}
          {isGCP && (
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Credentials Input Method
                </Label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGcpAuthMode('json')}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all',
                      gcpAuthMode === 'json'
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    <KeyRound className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Service Account JSON</p>
                      <p className="text-[10px] text-muted-foreground">Paste full JSON key file</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGcpAuthMode('fields')}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all',
                      gcpAuthMode === 'fields'
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    <Shield className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Manual Fields</p>
                      <p className="text-[10px] text-muted-foreground">Project ID & Private Key</p>
                    </div>
                  </button>
                </div>
              </div>

              {gcpAuthMode === 'json' ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gcp-json">Service Account Key (JSON) *</Label>
                    {hasExistingGCPSecret && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        • Current JSON key saved
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="gcp-json"
                    value={serviceAccountJson}
                    onChange={(e) => {
                      setServiceAccountJson(e.target.value);
                      try {
                        const parsed = JSON.parse(e.target.value);
                        if (parsed.project_id && !projectId) setProjectId(parsed.project_id);
                        if (parsed.client_email && !clientEmail) setClientEmail(parsed.client_email);
                      } catch {}
                    }}
                    placeholder={hasExistingGCPSecret ? '•••••••••••••••• (Leave blank to keep saved key)' : '{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  "client_email": "..."\n}'}
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="gcp-proj">Project ID *</Label>
                      <Input
                        id="gcp-proj"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        placeholder="my-gcp-project"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gcp-email">Client Email *</Label>
                      <Input
                        id="gcp-email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="sa-name@project.iam.gserviceaccount.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="gcp-key">Private Key PEM *</Label>
                      {source?.config?._private_key && (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          • Private key saved
                        </span>
                      )}
                    </div>
                    <Textarea
                      id="gcp-key"
                      value={gcpPrivateKey}
                      onChange={(e) => setGcpPrivateKey(e.target.value)}
                      placeholder={source?.config?._private_key ? '•••••••••••••••• (Leave blank to keep saved key)' : '-----BEGIN RSA PRIVATE KEY-----\n...'}
                      rows={3}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                Requires the <strong>Vertex AI Viewer</strong> (<code className="rounded bg-muted px-1 py-0.5 font-mono">roles/aiplatform.viewer</code>) role.{' '}
                <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                  Google Cloud Console <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          )}

          {/* Environment + Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scan Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Source</p>
              <p className="text-xs text-muted-foreground mt-0.5">When enabled, this source participates in AI discovery runs.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Data access note */}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex gap-3">
              <Shield className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">What OneKor accesses</p>
                <ul className="space-y-1">
                  {isGitHub && (
                    <>
                      <li>• Reads repository file trees, package manifests, and configuration files</li>
                      <li>• Never modifies repositories or stores your token in plain text</li>
                    </>
                  )}
                  {isAiPlatform && (
                    <>
                      <li>• Calls the models API to list available {connector.name} models and metadata</li>
                      <li>• Never sends completions, generates content, or modifies account settings</li>
                    </>
                  )}
                  {isAzure && (
                    <>
                      <li>• Reads Azure OpenAI deployments, Cognitive Services, and Azure ML metadata via ARM</li>
                      <li>• Read-only inspection; never creates or modifies Azure resources</li>
                    </>
                  )}
                  {isAWS && (
                    <>
                      <li>• Reads Bedrock foundation model lists and SageMaker endpoint configurations</li>
                      <li>• Read-only inspection; never invokes models or provisions infrastructure</li>
                    </>
                  )}
                  {isGCP && (
                    <>
                      <li>• Queries Vertex AI model and endpoint catalogs and Dialogflow agent metadata</li>
                      <li>• Read-only inspection; never deploys models or alters GCP IAM policies</li>
                    </>
                  )}
                  {!isGitHub && !isAiPlatform && !isCloud && (
                    <>
                      <li>• Reads metadata only — no write access is requested</li>
                      <li>• Credentials are never stored in plain text</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Test connection */}
          {(isGitHub || isAiPlatform || isCloud) && (
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || !hasCredential}
                className="w-full gap-2"
                id="btn-test-connection"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {testing ? 'Testing Connection…' : 'Test Connection'}
              </Button>

              {testResult && (
                <div className="space-y-3">
                  {/* Status header banner */}
                  <div className={cn(
                    'rounded-xl border p-4',
                    testResult.ok
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                      : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                  )}>
                    <div className="flex gap-2">
                      {testResult.ok
                        ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        : <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                      }
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-medium', testResult.ok ? 'text-emerald-900 dark:text-emerald-200' : 'text-red-900 dark:text-red-200')}>
                          {testResult.ok ? 'Connection Successful' : 'Connection Failed'}
                        </p>
                        {(testResult.message || testResult.error) && (
                          <p className="mt-1 text-xs text-muted-foreground">{testResult.message || testResult.error}</p>
                        )}
                        {testResult.ok && testResult.repo_count !== undefined && (
                          <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                            Discovered {testResult.repo_count} accessible repository(ies).
                          </p>
                        )}
                        {testResult.ok && testResult.model_count !== undefined && (
                          <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                            Discovered {testResult.model_count} available AI model(s).
                          </p>
                        )}
                        {testResult.ok && testResult.subscriptions_count !== undefined && (
                          <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                            Verified access to {testResult.subscriptions_count} Azure subscription(s).
                          </p>
                        )}
                        {testResult.ok && testResult.bedrock_models_count !== undefined && (
                          <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                            Verified access to {testResult.bedrock_models_count} Bedrock foundation model(s).
                          </p>
                        )}
                        {testResult.ok && testResult.vertex_models_count !== undefined && (
                          <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                            Verified access to {testResult.vertex_models_count} Vertex AI model(s).
                          </p>
                        )}
                        {testResult.steps?.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5">
                            {testResult.steps.map((s, i) => {
                              const passed = s.status === 'success' || s.status === 'connected';
                              return (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', passed ? 'bg-emerald-500' : s.status === 'warning' ? 'bg-amber-500' : 'bg-red-500')} />
                                  <span className="text-foreground/80 font-medium">{s.stage || `Stage ${i + 1}`}:</span>
                                  <span className="text-muted-foreground truncate">{s.message}</span>
                                  {s.latency_ms && <span className="ml-auto text-muted-foreground/60">{s.latency_ms}ms</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Real-time Diagnostics troubleshooting card on failure */}
                  {!testResult.ok && (
                    <DiagnosticCard
                      result={testResult}
                      connectorId={connector.id}
                      onRetry={handleTest}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !canSave} className="gap-2 px-6" id="btn-save-connection">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Connect & Save'}
            </Button>
          </div>

          {/* Current source status */}
          {source && (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Current Connection Status</p>
                  <div className="mt-1"><ConnectionStatusPill status={source.connection_status} /></div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Last Synced</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{formatRelative(source.last_successful_scan)}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Metadata ───────────────────────────────────────────────────
const METADATA_DEFINITIONS = {
  github: {
    sections: [
      {
        id: 'code_signals',
        label: 'Code Signals',
        description: 'Detection patterns applied to repository files during scanning.',
        items: [
          { id: 'ai_sdks', label: 'AI SDKs', description: 'OpenAI, Anthropic, Google AI, Azure OpenAI, Hugging Face, Replicate SDKs.', default: true },
          { id: 'ai_frameworks', label: 'AI Frameworks', description: 'LangChain, LlamaIndex, AutoGen, CrewAI, Vercel AI SDK.', default: true },
          { id: 'ai_models', label: 'AI Model References', description: 'Model name references in code and config (GPT, Claude, Gemini, Llama, etc.).', default: true },
          { id: 'ai_apis', label: 'AI API Endpoints', description: 'AI API endpoint references and usage patterns.', default: true },
          { id: 'ai_agents', label: 'AI Agents', description: 'Agent framework references and agent configuration files.', default: true },
          { id: 'mcp', label: 'MCP Servers', description: 'Model Context Protocol server references and SDK usage.', default: true },
          { id: 'ai_config', label: 'AI Configuration Files', description: 'AI-related config files (.env, config.yaml, docker-compose).', default: true },
          { id: 'ai_dependencies', label: 'AI Dependencies', description: 'Package manifests: package.json, requirements.txt, pyproject.toml.', default: true },
          { id: 'ai_workflows', label: 'CI/CD AI Steps', description: 'GitHub Actions workflows containing AI-related steps.', default: false },
        ],
      },
      {
        id: 'scope',
        label: 'Discovery Scope',
        description: 'Control which parts of your repositories are scanned.',
        scopeType: 'scope',
      },
    ],
  },
  openai: {
    sections: [{
      id: 'discovery',
      label: 'Model Discovery',
      description: 'What OpenAI data OneKor collects.',
      items: [
        { id: 'models', label: 'Model Catalog', description: 'All available OpenAI models (GPT, DALL-E, Whisper, Embeddings, o1, etc.).', default: true },
        { id: 'account', label: 'Account Metadata', description: 'Organization and account information from the API.', default: true },
        { id: 'model_metadata', label: 'Model Metadata', description: 'Model ownership, creation date, and lifecycle status.', default: true },
      ],
    }],
  },
  anthropic: {
    sections: [{
      id: 'discovery',
      label: 'Model Discovery',
      description: 'What Anthropic data OneKor collects.',
      items: [
        { id: 'models', label: 'Model Catalog', description: 'All Claude models (Opus, Sonnet, Haiku, etc.).', default: true },
        { id: 'model_capabilities', label: 'Model Capabilities', description: 'Thinking, vision, tools, citations, and extended context details.', default: true },
        { id: 'model_metadata', label: 'Model Metadata', description: 'Lifecycle status, token limits, and creation dates.', default: true },
      ],
    }],
  },
  azure: {
    sections: [{
      id: 'discovery',
      label: 'Azure AI Services Discovery',
      description: 'Configure which Azure AI services OneKor discovers and catalogues into AI Inventory.',
      items: [
        { id: 'azure_openai', label: 'Azure OpenAI Deployments', description: 'Discover GPT-4o, DALL-E, embeddings, and fine-tuned deployments.', default: true },
        { id: 'cognitive_services', label: 'Cognitive Services', description: 'Vision, Speech, Language, Translator, and Document Intelligence resources.', default: true },
        { id: 'ml_workspaces', label: 'Azure ML Workspaces', description: 'Machine Learning workspaces, registered models, and compute clusters.', default: true },
        { id: 'bot_services', label: 'Azure Bot Services', description: 'Conversational AI bots and agent integrations.', default: true },
      ],
    }],
  },
  aws: {
    sections: [{
      id: 'discovery',
      label: 'AWS AI Infrastructure Discovery',
      description: 'Configure which AWS AI services and models OneKor scans.',
      items: [
        { id: 'bedrock_models', label: 'Amazon Bedrock Foundation Models', description: 'Foundation models from Anthropic, Meta, Mistral, AI21, Cohere, and Amazon.', default: true },
        { id: 'sagemaker_endpoints', label: 'SageMaker Endpoints', description: 'Real-time, serverless, and asynchronous model hosting endpoints.', default: true },
        { id: 'custom_models', label: 'Custom & Fine-tuned Models', description: 'Custom model imports and fine-tuned Bedrock models.', default: true },
      ],
    }],
  },
  gcp: {
    sections: [{
      id: 'discovery',
      label: 'Google Cloud AI Discovery',
      description: 'Configure which Vertex AI and Google Cloud AI assets OneKor identifies.',
      items: [
        { id: 'vertex_models', label: 'Vertex AI Model Garden & Models', description: 'Gemini, PaLM, Codey, and custom uploaded Vertex models.', default: true },
        { id: 'vertex_endpoints', label: 'Vertex AI Deployed Endpoints', description: 'Active online prediction endpoints and traffic splits.', default: true },
        { id: 'dialogflow_agents', label: 'Dialogflow Agents', description: 'Dialogflow CX and ES conversational AI agents.', default: true },
      ],
    }],
  },
};

const DEFAULT_METADATA_DEF = {
  sections: [{
    id: 'general',
    label: 'Discovery Metadata',
    description: 'Configure what this connector discovers and surfaces in your AI inventory.',
    items: [
      { id: 'basic_metadata', label: 'Basic Metadata', description: 'Name, type, description, and version information.', default: true },
      { id: 'connection_info', label: 'Connection Information', description: 'Endpoints, authentication methods, and API surface.', default: true },
      { id: 'ownership', label: 'Ownership', description: 'Team, owner, department, and cost center data.', default: false },
      { id: 'usage_signals', label: 'Usage Signals', description: 'Activity indicators and usage patterns.', default: false },
    ],
  }],
};

function MetadataTab({ connector, source }) {
  const def = METADATA_DEFINITIONS[connector.id] || DEFAULT_METADATA_DEF;

  const [enabled, setEnabled] = useState(() => {
    const initial = {};
    for (const section of def.sections) {
      for (const item of (section.items || [])) {
        initial[item.id] = source?.config?.discovery_categories?.[item.id] ?? item.default;
      }
    }
    return initial;
  });

  const [repositoryMode, setRepositoryMode] = useState(source?.config?.repository_mode || 'all');
  const [repositories, setRepositories] = useState((source?.config?.repositories || []).join(', '));
  const [branch, setBranch] = useState(source?.config?.branch || '');
  const [pathFilter, setPathFilter] = useState(source?.config?.path_filter || '');
  const [excludeRepos, setExcludeRepos] = useState((source?.config?.exclude_repos || []).join(', '));

  const [saving, setSaving] = useState(false);
  const updateSource = useUpdateSource();
  const createAudit = useCreateAuditEvent();

  if (!source) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-10 text-center">
        <Database className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h3 className="mt-4 font-semibold text-foreground">Configure Connection First</h3>
        <p className="mt-1 text-sm text-muted-foreground">Save the connection settings before configuring discovery metadata and scope.</p>
      </div>
    );
  }

  const handleSaveMetadata = async () => {
    setSaving(true);
    try {
      const configUpdate = { ...source.config, discovery_categories: enabled };
      if (connector.id === 'github') {
        configUpdate.repository_mode = repositoryMode;
        configUpdate.repositories = repositoryMode === 'selected' ? repositories.split(',').map((r) => r.trim()).filter(Boolean) : [];
        configUpdate.branch = branch.trim() || undefined;
        configUpdate.path_filter = pathFilter.trim() || undefined;
        configUpdate.exclude_repos = excludeRepos.split(',').map((r) => r.trim()).filter(Boolean);
      }
      await updateSource.mutateAsync({ id: source.id, data: { config: configUpdate } });
      await createAudit.mutateAsync({ action: 'source_metadata_updated', resource_type: 'discovery_source', resource_id: source.id, result: 'success' });
    } finally {
      setSaving(false);
    }
  };

  const allItems = def.sections.flatMap((s) => s.items || []);

  return (
    <div className="space-y-6">
      {def.sections.map((section) => (
        <div key={section.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{section.description}</p>
          </div>

          {section.items && (
            <div className="space-y-2">
              {section.items.map((item) => (
                <div key={item.id} className={cn('flex items-start gap-3 rounded-xl p-3 transition-colors', enabled[item.id] ? 'bg-primary/5 ring-1 ring-primary/15' : 'bg-muted/30 hover:bg-muted/50')}>
                  <Checkbox
                    id={`meta-${item.id}`}
                    checked={enabled[item.id] || false}
                    onCheckedChange={(v) => setEnabled((prev) => ({ ...prev, [item.id]: !!v }))}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`meta-${item.id}`} className="cursor-pointer text-sm font-medium text-foreground">{item.label}</label>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  {enabled[item.id] && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">ON</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {section.scopeType === 'scope' && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Repository Scope</Label>
                <Select value={repositoryMode} onValueChange={setRepositoryMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accessible repositories</SelectItem>
                    <SelectItem value="selected">Selected repositories only</SelectItem>
                    <SelectItem value="org">Organization repositories</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {repositoryMode === 'selected' && (
                <div className="space-y-2">
                  <Label>Repositories</Label>
                  <Textarea value={repositories} onChange={(e) => setRepositories(e.target.value)} placeholder="repo-one, repo-two, my-org/repo-three" rows={2} />
                  <p className="text-xs text-muted-foreground">Comma-separated. Use <code>org/repo</code> for cross-org repos.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Branch Filter (optional)</Label>
                  <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
                </div>
                <div className="space-y-2">
                  <Label>Path Filter (optional)</Label>
                  <Input value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} placeholder="src/" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Exclude Repositories (optional)</Label>
                <Input value={excludeRepos} onChange={(e) => setExcludeRepos(e.target.value)} placeholder="archived-repo, test-only-repo" />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Discovery summary */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Discovery Summary</h3>
        <p className="text-xs text-muted-foreground mb-3">Based on current settings, OneKor will discover:</p>
        <div className="space-y-1.5">
          {allItems.filter((i) => enabled[i.id]).map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              {item.label}
            </div>
          ))}
          {allItems.filter((i) => !enabled[i.id]).map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveMetadata} disabled={saving} className="gap-2 px-6" id="btn-save-metadata">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Metadata Settings'}
        </Button>
      </div>
    </div>
  );
}

// ─── Tab: Logs ───────────────────────────────────────────────────────
const LOG_CATEGORY_LABELS = {
  connection: 'Connection',
  configuration: 'Configuration',
  metadata: 'Metadata',
  discovery: 'Discovery',
  error: 'Error',
  audit: 'Audit',
};

function LogsTab({ source }) {
  const [levelFilter, setLevelFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rawLogs = [], isLoading } = useSourceLogs(source?.id);

  const syntheticLogs = useMemo(() => {
    if (!source || rawLogs.length > 0) return [];
    const entries = [];
    if (source.created_date) {
      entries.push({
        id: 'synth-created',
        severity: 'info',
        category: 'audit',
        message: 'AI Source created',
        details: `connector_id: ${source.connector_id}`,
        created_date: source.created_date,
      });
    }
    if (source.connection_status === 'connected') {
      entries.push({
        id: 'synth-connected',
        severity: 'info',
        category: 'connection',
        message: 'Connection established successfully',
        details: 'Credentials validated and connection confirmed',
        created_date: source.created_date,
      });
    }
    return entries;
  }, [source, rawLogs]);

  const displayLogs = rawLogs.length > 0 ? rawLogs : syntheticLogs;

  const filtered = useMemo(() => {
    let result = [...displayLogs];
    if (levelFilter !== 'all') result = result.filter((l) => (l.severity || l.level) === levelFilter);
    if (categoryFilter !== 'all') result = result.filter((l) => l.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => (l.message || '').toLowerCase().includes(q) || (l.details || '').toLowerCase().includes(q));
    }
    return result;
  }, [displayLogs, levelFilter, categoryFilter, searchQuery]);

  if (!source) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-10 text-center">
        <Activity className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h3 className="mt-4 font-semibold text-foreground">No Logs Yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Logs will appear after the connection is configured and saved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search logs…" className="pl-8 h-8 text-xs" />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(LOG_CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 py-12 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">No logs found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery || levelFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Activity will appear here once this source runs discovery.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider w-36">Time</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider w-20">Level</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider w-28">Category</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Message</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, idx) => {
                const level = log.severity || log.level || 'info';
                const meta = LOG_SEVERITY_META[level] || LOG_SEVERITY_META.info;
                return (
                  <tr key={log.id || idx} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground font-mono">{formatDateTime(log.created_date)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1', meta.color)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', meta.dot)} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {LOG_CATEGORY_LABELS[log.category] || log.category || '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground max-w-[240px]">
                      <p className="truncate">{log.message || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                      <p className="truncate font-mono text-[11px]">{log.details || '—'}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} log {filtered.length === 1 ? 'entry' : 'entries'}</span>
          <span>Updated: {formatRelative(source?.updated_date || source?.created_date)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────
export default function ConnectorDetailPage({ connectorId }) {
  const connector = getConnector(connectorId);
  const { panel, area, mod } = useNav();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('connection');

  const { data: sources = [] } = useDiscoverySources();
  const existingSource = useMemo(
    () => sources.find((s) => s.connector_id === connectorId),
    [sources, connectorId]
  );

  const handleSourceSaved = (saved) => {
    navigate(pathFor(panel.id, area.id, mod.id, 'ai-sources') + `?source=${saved.id}`);
  };

  const handleBack = () => {
    navigate(pathFor(panel.id, area.id, mod.id, 'connectors'));
  };

  if (!connector) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-semibold text-foreground">Connector Not Found</h2>
          <Button variant="outline" onClick={handleBack} className="mt-4">Go back</Button>
        </div>
      </div>
    );
  }

  const Icon = connector.icon;
  const sourceCount = sources.filter((s) => s.connector_id === connectorId).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Back */}
      <button
        onClick={handleBack}
        className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        id="btn-back-connectors"
      >
        <ArrowLeft className="h-4 w-4" />
        Connectors
      </button>

      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-md ring-1 ring-black/10"
          style={{ backgroundColor: connector.color }}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{connector.name}</h1>
            <ConnectorStatusBadge status={connector.status} />
            {existingSource && <ConnectionStatusPill status={existingSource.connection_status} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{connector.description}</p>
          {sourceCount > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{sourceCount}</span> AI {sourceCount === 1 ? 'Source' : 'Sources'} configured
            </p>
          )}
        </div>
        {existingSource && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(pathFor(panel.id, area.id, mod.id, 'ai-sources') + `?source=${existingSource.id}`)}
            className="gap-1.5 shrink-0"
            id="btn-view-ai-source"
          >
            View AI Source <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDisabled = (tab.id === 'metadata' || tab.id === 'logs') && !existingSource;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => !isDisabled && setActiveTab(tab.id)}
              disabled={isDisabled}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : isDisabled
                    ? 'cursor-not-allowed text-muted-foreground/40'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              )}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'logs' && existingSource && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-tight">LIVE</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'connection' && (
        <ConnectionTab connector={connector} source={existingSource} onSourceSaved={handleSourceSaved} />
      )}
      {activeTab === 'metadata' && (
        <MetadataTab connector={connector} source={existingSource} />
      )}
      {activeTab === 'logs' && (
        <LogsTab source={existingSource} />
      )}
    </div>
  );
}
