import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronRight, ChevronLeft, Loader2, AlertCircle, KeyRound, Info } from 'lucide-react';
import { useCreateSource, useUpdateSource, useTestConnection, useCreateAuditEvent } from '@/lib/discovery/hooks';
import { cn } from '@/lib/utils';

const STEPS = ['Connection', 'Scope', 'Settings', 'Test', 'Save'];

export default function ConnectorConfigDialog({ connector, source, open, onOpenChange, onSaved }) {
  const isEdit = !!source;
  const isManual = connector.id === 'manual';
  const totalSteps = isManual ? 1 : STEPS.length;

  const [step, setStep] = useState(0);
  const [name, setName] = useState(source?.name || '');
  const [org, setOrg] = useState(source?.config?.organization || '');
  const [repos, setRepos] = useState((source?.config?.repositories || []).join(', '));
  const [branch, setBranch] = useState(source?.config?.branch || '');
  const [pathFilter, setPathFilter] = useState(source?.config?.path_filter || '');
  const [frequency, setFrequency] = useState(source?.scan_frequency || 'manual');
  const [enabled, setEnabled] = useState(source?.enabled !== false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Manual source fields
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('ai_application');
  const [assetProvider, setAssetProvider] = useState('');
  const [assetDesc, setAssetDesc] = useState('');

  const createSource = useCreateSource();
  const updateSource = useUpdateSource();
  const testConnection = useTestConnection();
  const createAudit = useCreateAuditEvent();

  const resetState = () => {
    setStep(0);
    setName('');
    setOrg('');
    setRepos('');
    setBranch('');
    setPathFilter('');
    setFrequency('manual');
    setEnabled(true);
    setTestResult(null);
    setTesting(false);
    setSaving(false);
    setAssetName('');
    setAssetType('ai_application');
    setAssetProvider('');
    setAssetDesc('');
  };

  const handleClose = (open) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const buildConfig = () => {
    if (isManual) {
      return { asset_name: assetName, asset_type: assetType, provider: assetProvider, description: assetDesc };
    }
    return {
      ...(source?.config || {}),
      organization: org.trim(),
      repositories: repos.trim() ? repos.split(',').map((r) => r.trim()).filter(Boolean) : [],
      branch: branch.trim(),
      path_filter: pathFilter.trim(),
    };
  };

  const buildSourceData = () => ({
    name: isManual ? assetName : (name || `${connector.name} ${org || 'Source'}`),
    connector_id: connector.id,
    status: 'active',
    connection_status: isManual ? 'connected' : (testResult?.ok ? 'connected' : (source?.connection_status || 'not_configured')),
    config: buildConfig(),
    credential_reference: connector.credentialSecret || null,
    scan_frequency: frequency,
    enabled,
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({
        sourceId: source?.id,
        connectorId: connector.id,
        config: buildConfig(),
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, status: 'error', error: err.message, steps: [] });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = buildSourceData();
      let saved;
      if (isEdit) {
        saved = await updateSource.mutateAsync({ id: source.id, data });
        await createAudit.mutateAsync({ action: 'source_updated', resource_type: 'discovery_source', resource_id: source.id, result: 'success', details: { name: data.name } });
      } else {
        saved = await createSource.mutateAsync(data);
        await createAudit.mutateAsync({ action: 'source_created', resource_type: 'discovery_source', resource_id: saved.id, result: 'success', details: { name: data.name, connector_id: connector.id } });
      }
      setSaving(false);
      handleClose(false);
      onSaved?.(saved);
    } catch (err) {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (isManual) return assetName.trim() && assetType;
    if (step === 0) return true;
    if (step === 1) return true;
    if (step === 2) return true;
    if (step === 3) return testResult?.ok;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <connector.icon className="h-5 w-5" style={{ color: connector.color }} />
            {isEdit ? `Edit ${source.name}` : `Configure ${connector.name}`}
          </DialogTitle>
          <DialogDescription>{connector.description}</DialogDescription>
        </DialogHeader>

        {!isManual && (
          <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                    i === step ? 'bg-background text-foreground shadow-sm' : i < step ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/40'
                  )}
                >
                  <span className={cn(
                    'grid h-5 w-5 place-items-center rounded-full text-[10px]',
                    i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {i < step ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {s}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
              </div>
            ))}
          </div>
        )}

        {/* Step 0: Connection */}
        {isManual ? (
          <ManualStep
            assetName={assetName} setAssetName={setAssetName}
            assetType={assetType} setAssetType={setAssetType}
            assetProvider={assetProvider} setAssetProvider={setAssetProvider}
            assetDesc={assetDesc} setAssetDesc={setAssetDesc}
          />
        ) : step === 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200">Credential Required</p>
                  {connector.credentialSecret === 'inline' ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      {connector.credentialHelp || `Enter your ${connector.name} credentials directly in the onboarding popup.`}
                    </p>
                  ) : (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      OneKor needs a <strong>{connector.credentialSecret}</strong> secret to connect to {connector.name}.
                      Set it in <strong>Dashboard → Secrets (Environment Variables)</strong>.
                    </p>
                  )}
                  {connector.credentialSecret !== 'inline' && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400/80">{connector.credentialHelp}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="src-name">Source Name</Label>
              <Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`My ${connector.name} Source`} />
              <p className="text-xs text-muted-foreground">A name to identify this discovery source.</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">What OneKor will do</p>
                  <p className="mt-1">OneKor will use your token to read repository file trees, package manifests, and configuration files. It will not modify any repositories or store your token in the database — only a credential reference is saved.</p>
                </div>
              </div>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org">Organization (optional)</Label>
              <Input id="org" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. my-organization" />
              <p className="text-xs text-muted-foreground">Leave empty to scan your own repositories. Enter an org name to scan organization repositories.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="repos">Repositories (optional)</Label>
              <Input id="repos" value={repos} onChange={(e) => setRepos(e.target.value)} placeholder="repo1, repo2, or leave empty for all" />
              <p className="text-xs text-muted-foreground">Comma-separated list of repository names to scan. Leave empty to scan all accessible repositories.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch Filter (optional)</Label>
                <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="path">Path Filter (optional)</Label>
                <Input id="path" value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} placeholder="src/" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Path filter limits scanning to files whose paths contain the given string.</p>
          </div>
        ) : step === 2 ? (
          <div className="space-y-4">
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
              <p className="text-xs text-muted-foreground">How often OneKor should automatically run discovery on this source.</p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Source</p>
                <p className="text-xs text-muted-foreground">When enabled, this source can be used for discovery.</p>
              </div>
              <Button
                size="sm"
                variant={enabled ? 'default' : 'outline'}
                onClick={() => setEnabled(!enabled)}
              >
                {enabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>
        ) : step === 3 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Test Connection</p>
              <p className="mt-1 text-xs text-muted-foreground">OneKor will validate your credentials and check repository access. No data is saved during testing.</p>
            </div>
            <Button onClick={handleTest} disabled={testing} className="w-full gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            {testResult && (
              <div className={cn('rounded-xl border p-4', testResult.ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30')}>
                <div className="flex gap-2">
                  {testResult.ok ? <Check className="h-5 w-5 shrink-0 text-emerald-600" /> : <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />}
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium', testResult.ok ? 'text-emerald-900 dark:text-emerald-200' : 'text-red-900 dark:text-red-200')}>
                      {testResult.ok ? 'Connection Successful' : 'Connection Failed'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{testResult.message || testResult.error}</p>
                    {testResult.steps && testResult.steps.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {testResult.steps.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={cn('h-1.5 w-1.5 rounded-full', s.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500')} />
                            <span className="text-muted-foreground">{s.message}</span>
                            {s.latency_ms && <span className="text-muted-foreground/60">{s.latency_ms}ms</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : step === 4 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex gap-2">
                <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Ready to Save</p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Review the configuration below and click Save to create this discovery source.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium text-foreground">{name || `${connector.name} Source`}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Connector</span><span className="font-medium text-foreground">{connector.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Organization</span><span className="font-medium text-foreground">{org || 'Personal'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Repositories</span><span className="font-medium text-foreground">{repos || 'All'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Frequency</span><span className="font-medium text-foreground capitalize">{frequency}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Enabled</span><span className="font-medium text-foreground">{enabled ? 'Yes' : 'No'}</span></div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {!isManual && step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {isManual ? (
            <Button onClick={handleSave} disabled={saving || !canProceed()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Source'}
            </Button>
          ) : step < totalSteps - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="gap-2">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Source'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualStep({ assetName, setAssetName, assetType, setAssetType, assetProvider, setAssetProvider, assetDesc, setAssetDesc }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex gap-2 text-xs text-blue-700 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0" />
          <p>Manually registered assets are labeled as <strong>MANUAL</strong> and kept separate from automatically discovered evidence.</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-name">Asset Name *</Label>
        <Input id="asset-name" value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g. Marketing GPT-4 Chatbot" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Asset Type</Label>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ai_application">AI Application</SelectItem>
              <SelectItem value="ai_agent">AI Agent</SelectItem>
              <SelectItem value="ai_model">AI Model</SelectItem>
              <SelectItem value="ai_api">AI API</SelectItem>
              <SelectItem value="ai_saas">AI SaaS</SelectItem>
              <SelectItem value="ai_copilot">AI Copilot</SelectItem>
              <SelectItem value="ai_workflow">AI Workflow</SelectItem>
              <SelectItem value="ai_platform">AI Platform</SelectItem>
              <SelectItem value="ai_integration">AI Integration</SelectItem>
              <SelectItem value="personal_ai_account">Personal AI Account</SelectItem>
              <SelectItem value="shadow_ai">Shadow AI</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="asset-provider">Provider</Label>
          <Input id="asset-provider" value={assetProvider} onChange={(e) => setAssetProvider(e.target.value)} placeholder="e.g. OpenAI" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-desc">Description</Label>
        <Textarea id="asset-desc" value={assetDesc} onChange={(e) => setAssetDesc(e.target.value)} placeholder="What does this AI asset do?" rows={3} />
      </div>
    </div>
  );
}