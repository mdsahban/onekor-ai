import { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Save, Plug, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateSource, useUpdateSource, useTestConnection, useCreateAuditEvent } from '@/lib/discovery/hooks';
import AiPlatformAssistant from './AiPlatformAssistant';
import StepAiConnection from './steps/StepAiConnection';
import StepAiAuth from './steps/StepAiAuth';
import StepAiDiscovery from './steps/StepAiDiscovery';
import StepAiTest from './steps/StepAiTest';
import StepAiReview from './steps/StepAiReview';
import StepAiConnect from './steps/StepAiConnect';

const STEPS = [
  { id: 'connection', label: 'Connection', num: 1 },
  { id: 'authentication', label: 'Authentication', num: 2 },
  { id: 'discovery', label: 'Discovery', num: 3 },
  { id: 'test', label: 'Test', num: 4 },
  { id: 'review', label: 'Review', num: 5 },
  { id: 'connect', label: 'Connect', num: 6 },
];

export default function AiPlatformOnboarding({ connector, source, open, onOpenChange, onSaved }) {
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
    apiKey: source?.config?._api_key || '',
    organization: source?.config?.organization || '',
    project: source?.config?.project || '',
    discoveryCategories: source?.config?.discovery_categories || {},
    scanFrequency: source?.scan_frequency || 'manual',
    enabled: source?.enabled !== false,
    // Validation state
    validatedAccount: null,
    validatedModels: [],
    testResult: null,
  }));

  const updateForm = useCallback((updates) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const buildConfig = useCallback(() => {
    const config = {
      auth_method: 'api_key',
      description: form.description || undefined,
      environment: form.environment,
      tags: form.tags,
      discovery_categories: form.discoveryCategories,
    };

    if (form.apiKey) config._api_key = form.apiKey;
    if (connector.id === 'openai') {
      if (form.organization) config.organization = form.organization;
      if (form.project) config.project = form.project;
    }

    return config;
  }, [form, connector.id]);

  const buildSourceData = useCallback((isDraft = false) => ({
    name: form.name,
    connector_id: connector.id,
    status: isDraft ? 'draft' : 'active',
    connection_status: isDraft ? 'not_configured' : (form.testResult?.ok ? 'connected' : 'not_configured'),
    config: buildConfig(),
    credential_reference: 'inline',
    scan_frequency: form.scanFrequency,
    enabled: isDraft ? false : form.enabled,
  }), [form, buildConfig, connector.id]);

  const handleSaveDraft = async () => {
    const data = buildSourceData(true);
    let saved;
    if (isEdit) {
      saved = await updateSource.mutateAsync({ id: source.id, data });
      await createAudit.mutateAsync({ action: 'source_updated', resource_type: 'discovery_source', resource_id: source.id, result: 'success', details: { name: data.name, draft: true } });
    } else {
      saved = await createSource.mutateAsync(data);
      await createAudit.mutateAsync({ action: 'source_created', resource_type: 'discovery_source', resource_id: saved.id, result: 'success', details: { name: data.name, connector_id: connector.id, draft: true } });
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
      await createAudit.mutateAsync({ action: 'source_created', resource_type: 'discovery_source', resource_id: saved.id, result: 'success', details: { name: data.name, connector_id: connector.id, connected: true } });
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
        return !!form.apiKey?.trim();
      case 'discovery':
        return true;
      case 'test':
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
    if (!open) setStep(0);
    onOpenChange(open);
  };

  const currentStepId = STEPS[step].id;
  const Icon = connector.icon;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[92vh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Configure {connector.name} Source</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ backgroundColor: connector.color }}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {isEdit ? `Edit ${source.name}` : `Configure ${connector.name}`}
              </h2>
              <p className="text-xs text-muted-foreground">{connector.description}</p>
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
              <StepAiConnection form={form} updateForm={updateForm} connectorName={connector.name} />
            )}
            {currentStepId === 'authentication' && (
              <StepAiAuth form={form} updateForm={updateForm} connector={connector} />
            )}
            {currentStepId === 'discovery' && (
              <StepAiDiscovery form={form} updateForm={updateForm} connector={connector} />
            )}
            {currentStepId === 'test' && (
              <StepAiTest form={form} updateForm={updateForm} buildConfig={buildConfig} connector={connector} />
            )}
            {currentStepId === 'review' && (
              <StepAiReview form={form} buildConfig={buildConfig} connector={connector} />
            )}
            {currentStepId === 'connect' && (
              <StepAiConnect form={form} onConnect={handleConnect} connector={connector} saving={createSource.isPending || updateSource.isPending} />
            )}
          </div>

          {/* Right: AI Engine Assistant */}
          <div className="hidden w-[340px] shrink-0 border-l border-border bg-muted/20 lg:block">
            <AiPlatformAssistant step={currentStepId} form={form} connector={connector} canProceed={canProceed} />
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