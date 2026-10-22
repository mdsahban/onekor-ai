import { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Save, Plug, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateSource, useUpdateSource, useTestConnection, useCreateAuditEvent } from '@/lib/discovery/hooks';
import AiAssistant from './AiAssistant';
import StepConnection from './steps/StepConnection';
import StepAuthentication from './steps/StepAuthentication';
import StepScope from './steps/StepScope';
import StepDiscoverySettings from './steps/StepDiscoverySettings';
import StepTest from './steps/StepTest';
import StepReview from './steps/StepReview';
import StepConnect from './steps/StepConnect';

const STEPS = [
  { id: 'connection', label: 'Connection', num: 1 },
  { id: 'authentication', label: 'Authentication', num: 2 },
  { id: 'scope', label: 'Scope', num: 3 },
  { id: 'discovery', label: 'Discovery', num: 4 },
  { id: 'test', label: 'Test', num: 5 },
  { id: 'review', label: 'Review', num: 6 },
  { id: 'connect', label: 'Connect', num: 7 },
];

export default function GitHubOnboarding({ source, open, onOpenChange, onSaved }) {
  const isEdit = !!source;
  const createSource = useCreateSource();
  const updateSource = useUpdateSource();
  const testConnection = useTestConnection();
  const createAudit = useCreateAuditEvent();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({
    name: source?.name || '',
    description: source?.config?.description || '',
    environment: source?.config?.environment || 'production',
    tags: source?.config?.tags || [],
    authMethod: source?.config?.auth_method || 'pat',
    token: source?.config?._token || '',
    appId: source?.config?._app_id || '',
    privateKey: source?.config?._private_key || '',
    privateKeyFileName: source?.config?._private_key_file_name || '',
    installationId: source?.config?._installation_id || null,
    organization: source?.config?.organization || '',
    repositoryMode: source?.config?.repository_mode || 'all',
    repositories: source?.config?.repositories || [],
    branch: source?.config?.branch || '',
    pathFilter: source?.config?.path_filter || '',
    excludeRepos: source?.config?.exclude_repos || [],
    discoveryCategories: source?.config?.discovery_categories || {},
    advanced: source?.config?.advanced || {},
    scanFrequency: source?.scan_frequency || 'manual',
    enabled: source?.enabled !== false,
    // Validation state
    validatedUser: null,
    validatedInstallations: [],
    availableRepos: [],
    testResult: null,
  }));

  const updateForm = useCallback((updates) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const buildConfig = useCallback(() => {
    const config = {
      auth_method: form.authMethod,
      description: form.description || undefined,
      environment: form.environment,
      tags: form.tags,
      organization: form.organization || undefined,
      repository_mode: form.repositoryMode,
      repositories: form.repositoryMode === 'selected' ? form.repositories : [],
      branch: form.branch || undefined,
      path_filter: form.pathFilter || undefined,
      exclude_repos: form.excludeRepos,
      discovery_categories: form.discoveryCategories,
      advanced: form.advanced,
    };

    if (form.authMethod === 'pat' && form.token) {
      config._token = form.token;
      config.token = form.token;
    }
    if (form.authMethod === 'github_app') {
      if (form.appId) { config._app_id = form.appId; config.appId = form.appId; }
      if (form.privateKey) { config._private_key = form.privateKey; config.privateKey = form.privateKey; }
      if (form.privateKeyFileName) config._private_key_file_name = form.privateKeyFileName;
      if (form.installationId) { config._installation_id = form.installationId; config.installationId = form.installationId; }
    }

    return config;
  }, [form]);

  const buildSourceData = useCallback((isDraft = false) => ({
    name: form.name,
    connector_id: 'github',
    status: isDraft ? 'draft' : 'active',
    connection_status: isDraft ? 'not_configured' : (form.testResult?.ok ? 'connected' : 'not_configured'),
    config: buildConfig(),
    credential_reference: 'inline',
    scan_frequency: form.scanFrequency,
    enabled: isDraft ? false : form.enabled,
  }), [form, buildConfig]);

  const handleSaveDraft = async () => {
    const data = buildSourceData(true);
    let saved;
    if (isEdit) {
      saved = await updateSource.mutateAsync({ id: source.id, data });
      await createAudit.mutateAsync({ action: 'source_updated', resource_type: 'discovery_source', resource_id: source.id, result: 'success', details: { name: data.name, draft: true } });
    } else {
      saved = await createSource.mutateAsync(data);
      await createAudit.mutateAsync({ action: 'source_created', resource_type: 'discovery_source', resource_id: saved.id, result: 'success', details: { name: data.name, connector_id: 'github', draft: true } });
    }
    onOpenChange(false);
    onSaved?.(saved);
  };

  const handleConnect = async () => {
    const data = buildSourceData(false);
    let saved;
    if (isEdit) {
      saved = await updateSource.mutateAsync({ id: source.id, data });
      await createAudit.mutateAsync({ action: 'source_updated', resource_type: 'discovery_source', resource_id: source.id, result: 'success', details: { name: data.name, connected: true } });
    } else {
      saved = await createSource.mutateAsync(data);
      await createAudit.mutateAsync({ action: 'source_created', resource_type: 'discovery_source', resource_id: saved.id, result: 'success', details: { name: data.name, connector_id: 'github', connected: true } });
    }
    await createAudit.mutateAsync({ action: 'connection_succeeded', resource_type: 'discovery_source', resource_id: saved.id, result: 'success' });
    onOpenChange(false);
    onSaved?.(saved);
  };

  const canProceed = useMemo(() => {
    switch (STEPS[step].id) {
      case 'connection':
        return form.name.trim().length >= 2;
      case 'authentication':
        // Validation is optional — credentials just need to be entered to continue
        if (form.authMethod === 'pat') return !!form.token?.trim();
        if (form.authMethod === 'github_app') return !!form.appId?.trim() && !!form.privateKey;
        return false;
      case 'scope':
        if (form.repositoryMode === 'selected') return form.repositories.length > 0;
        return true;
      case 'discovery':
        return true;
      case 'test':
        // Allow continuing to Review so the source can be saved as a draft; Connect still requires a passing test
        return true;
      case 'review':
        return true;
      case 'connect':
        return true;
      default:
        return false;
    }
  }, [step, form]);

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleClose = (open) => {
    if (!open) {
      setStep(0);
    }
    onOpenChange(open);
  };

  const currentStepId = STEPS[step].id;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[92vh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Configure GitHub Source</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#24292f] text-white">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {isEdit ? `Edit ${source.name}` : 'Configure GitHub'}
              </h2>
              <p className="text-xs text-muted-foreground">Discover AI assets from GitHub repositories</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleClose(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Step progress */}
        <div className="border-b border-border bg-muted/30 px-6 py-3">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-1 items-center">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                    i === step ? 'text-foreground' : i < step ? 'text-primary hover:bg-primary/10 cursor-pointer' : 'text-muted-foreground/40 cursor-not-allowed'
                  )}
                >
                  <span className={cn(
                    'grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold transition-colors',
                    i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground'
                  )}>
                    {i < step ? <Check className="h-3 w-3" /> : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn('mx-1 h-px flex-1', i < step ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body: two-column layout */}
        <div className="flex min-h-0 flex-1">
          {/* Left: Configuration (scrollable) */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {currentStepId === 'connection' && (
              <StepConnection form={form} updateForm={updateForm} />
            )}
            {currentStepId === 'authentication' && (
              <StepAuthentication form={form} updateForm={updateForm} />
            )}
            {currentStepId === 'scope' && (
              <StepScope form={form} updateForm={updateForm} />
            )}
            {currentStepId === 'discovery' && (
              <StepDiscoverySettings form={form} updateForm={updateForm} />
            )}
            {currentStepId === 'test' && (
              <StepTest form={form} updateForm={updateForm} buildConfig={buildConfig} />
            )}
            {currentStepId === 'review' && (
              <StepReview form={form} buildConfig={buildConfig} />
            )}
            {currentStepId === 'connect' && (
              <StepConnect form={form} onConnect={handleConnect} saving={createSource.isPending || updateSource.isPending} />
            )}
          </div>

          {/* Right: AI Engine Assistant */}
          <div className="hidden w-[340px] shrink-0 border-l border-border bg-muted/20 lg:block">
            <AiAssistant step={currentStepId} form={form} canProceed={canProceed} />
          </div>
        </div>

        {/* Footer */}
        {currentStepId !== 'connect' && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={handleBack} className="gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {currentStepId === 'review' && (
                <Button variant="outline" onClick={handleSaveDraft} disabled={createSource.isPending || updateSource.isPending} className="gap-2">
                  <Save className="h-4 w-4" /> Save as Draft
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button onClick={handleNext} disabled={!canProceed} className="gap-2">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={!form.testResult?.ok || createSource.isPending || updateSource.isPending} className="gap-2">
                  <Plug className="h-4 w-4" /> Connect
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}