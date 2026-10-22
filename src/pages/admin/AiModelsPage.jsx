import { useState, useMemo, useEffect } from 'react';
import { useNav } from '@/components/layout/AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import {
  useAiModels, useCreateAiModel, useUpdateAiModel,
  useDeleteAiModel, useValidateAiModel, useDetectionProfiles,
} from '@/lib/discovery/scan-hooks';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Brain, Plus, Pencil, Trash2, CheckCircle2, XCircle, Loader2, KeyRound,
  Zap, ShieldCheck, Activity, Search, Server, Sparkles, Sliders, Globe,
  Shield, Check, AlertTriangle, ArrowUpRight, Cpu, Eye, EyeOff, RefreshCw,
  ExternalLink, Layers, Code,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PROVIDER_METAS = {
  openai: {
    label: 'OpenAI',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    label: 'Anthropic',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022'],
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  google: {
    label: 'Google Vertex / Gemini',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  custom: {
    label: 'Custom / BYOLLM',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    defaultModels: ['custom-llm-v1', 'llama-3.1-70b', 'mistral-large', 'qwen-2.5-72b'],
    defaultBaseUrl: 'http://localhost:8000/v1',
  },
};

const ALL_CAPABILITIES = [
  { id: 'text', label: 'Text Generation' },
  { id: 'vision', label: 'Vision / Multimodal' },
  { id: 'function_calling', label: 'Tool / Function Calling' },
  { id: 'code', label: 'Code Analysis' },
  { id: 'reasoning', label: 'Deep Reasoning' },
];

export default function AiModelsPage() {
  const { feature } = useNav();
  const { t } = useLanguage();
  const { data: models = [], isLoading, refetch, isFetching } = useAiModels();
  const { data: detectionProfiles = [] } = useDetectionProfiles();
  const deleteModel = useDeleteAiModel();

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [validateOpen, setValidateOpen] = useState(false);
  const [validating, setValidating] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Map each model to how many detection profiles reference it
  const modelUsageMap = useMemo(() => {
    const counts = {};
    for (const p of detectionProfiles) {
      if (p.ai_model_id) {
        counts[p.ai_model_id] = (counts[p.ai_model_id] || 0) + 1;
      }
    }
    return counts;
  }, [detectionProfiles]);

  // Filtered models
  const filtered = useMemo(() => {
    return models.filter((m) => {
      if (providerFilter !== 'all' && m.provider !== providerFilter) return false;
      if (statusFilter === 'validated' && !m.is_validated) return false;
      if (statusFilter === 'failed' && m.validation_status !== 'failed') return false;
      if (statusFilter === 'not_validated' && (m.is_validated || m.validation_status === 'failed')) return false;

      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (m.name || '').toLowerCase().includes(q);
        const displayMatch = (m.display_name || '').toLowerCase().includes(q);
        const modelIdMatch = (m.model_id || '').toLowerCase().includes(q);
        if (!nameMatch && !displayMatch && !modelIdMatch) return false;
      }
      return true;
    });
  }, [models, providerFilter, statusFilter, search]);

  const validatedCount = models.filter((m) => m.is_validated).length;
  const customCount = models.filter((m) => m.provider === 'custom').length;
  const inUseCount = Object.keys(modelUsageMap).length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteModel.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {feature?.name || 'LLM Engines'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Central integration layer for LLM engines used by AI Detection, heuristic classification, and platform services.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="gap-2 h-9"
            onClick={() => {
              setEditing(null);
              setEditOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add LLM Engine
          </Button>
        </div>
      </div>

      {/* ─── High-Level Metric Tiles ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Configured Engines</span>
            <Cpu className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{models.length}</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/15 dark:bg-emerald-950/10 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider">Validated &amp; Ready</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {validatedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-primary">
            <span className="text-xs font-medium uppercase tracking-wider">Active In Detection</span>
            <Crosshair className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">{inUseCount}</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-50/15 dark:bg-amber-950/10 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-medium uppercase tracking-wider">Custom / BYOLLM</span>
            <Server className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {customCount}
          </p>
        </div>
      </div>

      {/* ─── Search & Controls Bar ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search engines by name, model ID…"
              className="pl-9 h-9"
            />
          </div>

          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="google">Google Vertex</SelectItem>
              <SelectItem value="custom">Custom BYOLLM</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="validated">Validated</SelectItem>
              <SelectItem value="not_validated">Not Validated</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-muted-foreground"
            onClick={() => refetch()}
            title="Refresh engines"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/30 p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              className="h-8 text-xs px-2.5"
              onClick={() => setViewMode('cards')}
            >
              Cards
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              className="h-8 text-xs px-2.5"
              onClick={() => setViewMode('table')}
            >
              Table
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Engine Directory Content ─── */}
      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card py-16 text-center">
          <Brain className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No LLM Engines configured</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            {models.length === 0
              ? 'Onboard an OpenAI, Anthropic, Google Vertex, or Custom BYOLLM engine to enable AI-powered detection and classification.'
              : 'No engines match your current filter criteria.'}
          </p>
          {models.length === 0 && (
            <Button className="mt-4 gap-2" onClick={() => { setEditing(null); setEditOpen(true); }}>
              <Plus className="h-4 w-4" /> Onboard First LLM Engine
            </Button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((model) => (
            <EngineCard
              key={model.id}
              model={model}
              usageCount={modelUsageMap[model.id] || 0}
              onEdit={() => {
                setEditing(model);
                setEditOpen(true);
              }}
              onValidate={() => {
                setValidating(model);
                setValidateOpen(true);
              }}
              onDelete={() => setDeleteTarget(model)}
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Engine / Display Name</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Model ID</th>
                <th className="px-4 py-3 font-medium">Connection Status</th>
                <th className="px-4 py-3 font-medium">Capabilities</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((model) => (
                <EngineTableRow
                  key={model.id}
                  model={model}
                  usageCount={modelUsageMap[model.id] || 0}
                  onEdit={() => {
                    setEditing(model);
                    setEditOpen(true);
                  }}
                  onValidate={() => {
                    setValidating(model);
                    setValidateOpen(true);
                  }}
                  onDelete={() => setDeleteTarget(model)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Onboarding & Configuration Modal ─── */}
      {editOpen && (
        <EngineConfigDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          model={editing}
        />
      )}

      {/* ─── Live Validation Dialog ─── */}
      {validateOpen && validating && (
        <ValidateDialog
          open={validateOpen}
          onOpenChange={setValidateOpen}
          model={validating}
        />
      )}

      {/* ─── Delete Confirmation Dialog ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete LLM Engine "{deleteTarget?.display_name || deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this engine from the directory. Detection profiles configured with this engine will fall back to heuristic rule analysis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete Engine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Engine Card View ──────────────────────────────────────────────────────
function EngineCard({ model, usageCount, onEdit, onValidate, onDelete }) {
  const updateModel = useUpdateAiModel();
  const meta = PROVIDER_METAS[model.provider] || PROVIDER_METAS.custom;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm flex flex-col justify-between hover:border-border transition-all">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-foreground text-base">
                {model.display_name || model.name}
              </h3>
              {model.is_validated ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : model.validation_status === 'failed' ? (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              )}
            </div>
            <p className="mt-0.5 text-xs font-mono text-muted-foreground truncate">{model.model_id}</p>
          </div>

          <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium border capitalize', meta.color)}>
            {meta.label}
          </span>
        </div>

        {/* Status badges & usage */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] h-5',
              model.is_validated ? 'text-emerald-600 bg-emerald-500/5 border-emerald-500/20' : model.validation_status === 'failed' ? 'text-red-600 bg-red-500/5 border-red-500/20' : 'text-amber-600'
            )}
          >
            {model.is_validated ? 'Validated' : model.validation_status === 'failed' ? 'Validation Failed' : 'Pending Validation'}
          </Badge>

          {usageCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              <Crosshair className="h-3 w-3" /> Used in {usageCount} profile(s)
            </Badge>
          )}

          {model.is_onekor_managed && (
            <Badge variant="secondary" className="text-[10px] h-5 text-primary">
              OneKor Managed
            </Badge>
          )}
        </div>

        {/* Capabilities */}
        <div className="mt-3 flex flex-wrap gap-1">
          {(model.capabilities || ['text']).map((c) => (
            <Badge key={c} variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground">
              {c}
            </Badge>
          ))}
        </div>

        {/* Validation error snippet if failed */}
        {model.validation_error && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-50/15 dark:bg-red-950/20 p-2 text-xs text-red-600 dark:text-red-400 font-mono truncate">
            {model.validation_error}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={model.enabled}
            onCheckedChange={(v) => updateModel.mutate({ id: model.id, data: { enabled: v } })}
          />
          <span className="text-xs text-muted-foreground">{model.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onValidate}>
            <Zap className="h-3 w-3" /> Test
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Engine Table Row ──────────────────────────────────────────────────────
function EngineTableRow({ model, usageCount, onEdit, onValidate, onDelete }) {
  const updateModel = useUpdateAiModel();
  const meta = PROVIDER_METAS[model.provider] || PROVIDER_METAS.custom;

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Brain className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{model.display_name || model.name}</p>
            <p className="text-xs text-muted-foreground">{model.api_base_url || meta.defaultBaseUrl}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border capitalize', meta.color)}>
          {meta.label}
        </span>
      </td>

      <td className="px-4 py-3 font-mono text-xs text-foreground">
        {model.model_id}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {model.is_validated ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Validated
            </span>
          ) : model.validation_status === 'failed' ? (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
              <XCircle className="h-3.5 w-3.5" /> Failed
            </span>
          ) : (
            <span className="text-xs text-amber-600 font-medium">Pending Test</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1 max-w-xs">
          {(model.capabilities || ['text']).map((c) => (
            <Badge key={c} variant="outline" className="text-[10px] px-1 py-0">
              {c}
            </Badge>
          ))}
        </div>
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground">
        {usageCount > 0 ? (
          <span className="text-foreground font-medium">{usageCount} detection profile(s)</span>
        ) : (
          <span>Standby</span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onValidate}>
            <Zap className="h-3 w-3" /> Test
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Onboarding & Configuration Modal ──────────────────────────────────────
function EngineConfigDialog({ open, onOpenChange, model }) {
  const createModel = useCreateAiModel();
  const updateModel = useUpdateAiModel();

  const [provider, setProvider] = useState(model?.provider || 'openai');
  const [name, setName] = useState(model?.name || '');
  const [displayName, setDisplayName] = useState(model?.display_name || '');
  const [modelId, setModelId] = useState(model?.model_id || '');
  const [apiBaseUrl, setApiBaseUrl] = useState(model?.api_base_url || '');
  const [apiKey, setApiKey] = useState('');
  const [maxTokens, setMaxTokens] = useState(model?.max_tokens || 4096);
  const [contextWindow, setContextWindow] = useState(model?.context_window || 128000);
  const [capabilities, setCapabilities] = useState(model?.capabilities || ['text', 'vision', 'function_calling']);
  const [isOnekorManaged, setIsOnekorManaged] = useState(model?.is_onekor_managed || false);
  const [enabled, setEnabled] = useState(model?.enabled ?? true);

  // Custom BYOLLM options
  const [authMethod, setAuthMethod] = useState(model?.config?.auth_method || 'bearer');
  const [customHeaders, setCustomHeaders] = useState(
    model?.config?.headers ? JSON.stringify(model.config.headers, null, 2) : ''
  );
  const [timeoutMs, setTimeoutMs] = useState(model?.config?.timeout_ms || 30000);
  const [maxRetries, setMaxRetries] = useState(model?.config?.max_retries || 3);

  // When provider changes, suggest defaults
  const handleProviderChange = (p) => {
    setProvider(p);
    const meta = PROVIDER_METAS[p];
    if (meta && meta.defaultModels?.length > 0 && !model) {
      setModelId(meta.defaultModels[0]);
      setApiBaseUrl(meta.defaultBaseUrl);
      if (!name) setName(`${meta.label} Engine`);
      if (!displayName) setDisplayName(`${meta.label} (${meta.defaultModels[0]})`);
    }
  };

  const toggleCap = (capId) => {
    setCapabilities((prev) =>
      prev.includes(capId) ? prev.filter((x) => x !== capId) : [...prev, capId]
    );
  };

  const handleSave = async () => {
    let parsedHeaders = null;
    if (customHeaders.trim()) {
      try {
        parsedHeaders = JSON.parse(customHeaders);
      } catch (e) {
        alert('Custom headers must be valid JSON.');
        return;
      }
    }

    const payload = {
      name: name || displayName || modelId,
      display_name: displayName || name,
      provider,
      model_id: modelId,
      api_base_url: apiBaseUrl || PROVIDER_METAS[provider]?.defaultBaseUrl,
      max_tokens: Number(maxTokens),
      context_window: Number(contextWindow),
      capabilities,
      is_onekor_managed: isOnekorManaged,
      enabled,
      config: {
        ...(model?.config || {}),
        auth_method: authMethod,
        timeout_ms: Number(timeoutMs),
        max_retries: Number(maxRetries),
        headers: parsedHeaders,
        ...(apiKey ? { _api_key: apiKey } : {}),
      },
    };

    if (model) {
      await updateModel.mutateAsync({ id: model.id, data: payload });
    } else {
      await createModel.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            {model ? 'Edit LLM Engine' : 'Onboard LLM Engine'}
          </DialogTitle>
          <DialogDescription>
            Configure an enterprise LLM provider or Custom BYOLLM endpoint for AI Detection and heuristic classification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <Label>LLM Provider Architecture</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(PROVIDER_METAS).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleProviderChange(key)}
                  className={cn(
                    'flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all',
                    provider === key
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/20 font-semibold'
                      : 'border-border/70 hover:bg-muted/40'
                  )}
                >
                  <span className="text-xs text-foreground">{meta.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Engine Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production GPT-4o"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. OpenAI GPT-4o (Default)"
              />
            </div>
          </div>

          {/* Model Identifier & Endpoint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Model Identifier</Label>
              {PROVIDER_METAS[provider]?.defaultModels?.length > 0 && provider !== 'custom' ? (
                <div className="space-y-2">
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select or type model ID" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_METAS[provider].defaultModels.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder="Or type custom model identifier"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              ) : (
                <Input
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="e.g. llama-3.1-70b, mistral-large"
                  className="font-mono"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Endpoint Base URL</Label>
              <Input
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder={PROVIDER_METAS[provider]?.defaultBaseUrl || 'https://…'}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Credentials */}
          <div className="space-y-1.5">
            <Label className="flex items-center justify-between">
              <span>API Key / Secret Token</span>
              <span className="text-[11px] font-normal text-muted-foreground">Stored securely; never returned to client</span>
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={model ? '•••••••••••••••• (Leave blank to keep current)' : 'Enter API key or Bearer token'}
            />
          </div>

          {/* BYOLLM Extended Controls */}
          {provider === 'custom' && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-50/15 dark:bg-amber-950/10 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Server className="h-4 w-4" /> BYOLLM Custom Deployment Settings
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Authentication Type</Label>
                  <Select value={authMethod} onValueChange={setAuthMethod}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bearer">Bearer Token (Authorization)</SelectItem>
                      <SelectItem value="api_key_header">x-api-key Header</SelectItem>
                      <SelectItem value="custom_header">Custom Headers</SelectItem>
                      <SelectItem value="none">None / Open Endpoint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Custom Request Headers (JSON)</Label>
                <Textarea
                  value={customHeaders}
                  onChange={(e) => setCustomHeaders(e.target.value)}
                  placeholder={`{\n  "X-Custom-Auth": "secret",\n  "OpenAI-Organization": "org_123"\n}`}
                  className="h-16 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Capabilities */}
          <div className="space-y-1.5">
            <Label>Model Capabilities</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_CAPABILITIES.map((cap) => {
                const active = capabilities.includes(cap.id);
                return (
                  <button
                    key={cap.id}
                    type="button"
                    onClick={() => toggleCap(cap.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/70 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {cap.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Limits & Flags */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <span className="text-xs text-foreground font-medium">Enable Engine</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={isOnekorManaged} onCheckedChange={setIsOnekorManaged} />
              <span className="text-xs text-foreground font-medium">OneKor Managed Service</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name || !modelId || createModel.isPending || updateModel.isPending}
          >
            {createModel.isPending || updateModel.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : model ? 'Save Changes' : 'Onboard Engine'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Live Validation & Health Check Dialog ──────────────────────────────────
function ValidateDialog({ open, onOpenChange, model }) {
  const validate = useValidateAiModel();
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState(null);

  const handleValidate = async () => {
    const res = await validate.mutateAsync({
      provider: model.provider,
      apiKey: apiKey || 'stored',
      baseUrl: model.api_base_url,
      modelId: model.model_id,
      modelDbId: model.id,
    });
    setResult(res);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Connectivity Test: {model.display_name || model.name}
          </DialogTitle>
          <DialogDescription>
            Verify connectivity, validate model identifier access, and check supported capabilities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="space-y-1.5">
            <Label>API Key or Secret</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter key to test and save to secure storage"
            />
          </div>

          {result && (
            <div className={cn(
              'rounded-xl border p-3.5 space-y-2',
              result.validated
                ? 'border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/15'
                : 'border-red-500/30 bg-red-50/20 dark:bg-red-950/15'
            )}>
              <div className="flex items-center gap-2">
                {result.validated ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="font-semibold text-foreground text-sm">
                  {result.validated ? 'Engine Validated Successfully' : 'Connectivity Test Failed'}
                </span>
              </div>

              {result.validation_error && (
                <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                  {result.validation_error}
                </p>
              )}

              {result.capabilities?.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Verified capabilities: <strong>{result.capabilities.join(', ')}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleValidate}
            disabled={validate.isPending}
            className="gap-2"
          >
            {validate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Execute Health Check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}