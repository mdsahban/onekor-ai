import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNav } from '@/components/layout/AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import {
  useAiAssets, useDiscoverySources, useCreateAiAsset,
  useBulkUpdateAiAssets, useDeleteAiAsset, useCreateAuditEvent,
} from '@/lib/discovery/hooks';
import {
  ASSET_TYPE_LABELS, formatRelative, REVIEW_STATUS_META,
  RISK_LEVEL_META, LIFECYCLE_META, DATA_SENSITIVITY_META,
} from '@/lib/discovery/helpers';
import { ConfidenceBadge } from '@/components/discovery/Badges';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  LayoutGrid, Table as TableIcon, List, Search, Boxes, Eye, ExternalLink,
  ChevronRight, ChevronUp, ChevronDown, Brain, Bot, AppWindow, Code, Server,
  Link, Workflow, Sparkles, Cloud, UserCircle, Ghost, Shield, AlertTriangle,
  Check, X, Flag, Plus, Trash2, ScanSearch, Activity, AlertCircle, Lock,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Asset type icon map ───────────────────────────────────────────────────────
const TYPE_ICONS = {
  ai_application: AppWindow, ai_agent: Bot, ai_model: Brain, ai_api: Code,
  ai_saas: Cloud, ai_copilot: Sparkles, ai_workflow: Workflow, ai_platform: Server,
  ai_integration: Link, ai_account: UserCircle, personal_ai_account: UserCircle, shadow_ai: Ghost,
};

const PROVIDER_COLORS = {
  openai: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  anthropic: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  github: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  google: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  microsoft: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  aws: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  huggingface: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
};

// ─── Shared badge helpers ──────────────────────────────────────────────────────
function ReviewBadge({ status, className }) {
  const m = REVIEW_STATUS_META[status] || REVIEW_STATUS_META.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', m.bg, m.color, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function RiskBadge({ level, className }) {
  const m = RISK_LEVEL_META[level] || RISK_LEVEL_META.unknown;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border', m.bg, m.color, m.border, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function LifecycleBadge({ stage, className }) {
  const m = LIFECYCLE_META[stage] || LIFECYCLE_META.unknown;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', m.bg, m.color, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function ProviderBadge({ provider }) {
  const color = PROVIDER_COLORS[provider?.toLowerCase()] || 'bg-primary/10 text-primary';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', color)}>
      {provider || 'Unknown'}
    </span>
  );
}

function AssetTypeIcon({ type, size = 'md' }) {
  const Icon = TYPE_ICONS[type] || Boxes;
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10' };
  const iconSizes = { sm: 'h-4 w-4', md: 'h-5 w-5' };
  return (
    <div className={cn('grid shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15', sizes[size])}>
      <Icon className={iconSizes[size]} />
    </div>
  );
}

// ─── KPI stat card ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, icon: Icon, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group rounded-2xl border p-4 text-left shadow-sm transition-all hover:shadow-md',
        active
          ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border/70 bg-card hover:border-border',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4', color || 'text-muted-foreground/50')} />}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', color || 'text-foreground')}>{value}</p>
    </button>
  );
}

// ─── View toggle ───────────────────────────────────────────────────────────────
function ViewToggle({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// ─── Sortable column header ────────────────────────────────────────────────────
function SortHeader({ label, field, sort, onSort }) {
  const isActive = sort === field || sort === `-${field}`;
  const isDesc = sort === `-${field}`;
  return (
    <button
      className={cn('flex items-center gap-1 font-medium hover:text-foreground transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground')}
      onClick={() => onSort(isActive && isDesc ? field : `-${field}`)}
    >
      {label}
      {isActive ? (isDesc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

// ─── Bulk operations bar ───────────────────────────────────────────────────────
function BulkBar({ selected, onDeselect, onBulkAction, onDelete }) {
  const count = selected.length;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-xl ring-1 ring-border/50">
        <span className="text-sm font-semibold text-foreground">{count} selected</span>
        <div className="h-4 w-px bg-border/70" />
        <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/40"
          onClick={() => onBulkAction('confirmed')}>
          <Check className="h-3.5 w-3.5" /> Confirm
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
          onClick={() => onBulkAction('rejected')}>
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950/40"
          onClick={() => onBulkAction('needs_review')}>
          <Flag className="h-3.5 w-3.5" /> Flag
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-red-600 hover:text-red-700"
          onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onDeselect}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>
    </div>
  );
}

// ─── Asset card ────────────────────────────────────────────────────────────────
function AssetCard({ asset, onOpen, bulkMode, selected, onSelect }) {
  const enriched = asset.enriched_data || {};
  const isSelected = selected.includes(asset.id);

  return (
    <div
      className={cn(
        'group relative rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md',
        isSelected ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border/70',
      )}
    >
      {bulkMode && (
        <button
          className={cn(
            'absolute left-3 top-3 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 bg-background hover:border-primary/50',
          )}
          onClick={(e) => { e.stopPropagation(); onSelect(asset.id); }}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </button>
      )}

      <div className={cn('flex items-start justify-between gap-3', bulkMode && 'pl-6')}>
        <div className="flex items-start gap-3 min-w-0">
          <AssetTypeIcon type={asset.asset_type} />
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold text-foreground">{asset.display_name || asset.name}</h3>
            <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}</p>
          </div>
        </div>
        <RiskBadge level={asset.risk_level} className="shrink-0" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ProviderBadge provider={asset.provider} />
        <ReviewBadge status={asset.review_status} />
        <ConfidenceBadge
          level={(asset.confidence_score || 0) >= 0.75 ? 'high' : (asset.confidence_score || 0) >= 0.5 ? 'medium' : 'low'}
          score={asset.confidence_score}
        />
        {asset.lifecycle_stage && asset.lifecycle_stage !== 'unknown' && (
          <LifecycleBadge stage={asset.lifecycle_stage} />
        )}
      </div>

      {asset.description && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{asset.description}</p>
      )}

      <div className="mt-3 space-y-1 text-xs">
        {asset.business_owner && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <UserCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{asset.business_owner}</span>
          </div>
        )}
        {asset.environment && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Server className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate capitalize">{asset.environment}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>{formatRelative(asset.last_seen || asset.created_date)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="gap-1.5">
          <Eye className="h-3.5 w-3.5" /> View Profile
        </Button>
        {enriched.url && (
          <a href={enriched.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Source
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Manual registration modal ─────────────────────────────────────────────────
const EMPTY_FORM = {
  display_name: '', name: '', asset_type: '', provider: '', description: '',
  risk_level: 'unknown', lifecycle_stage: 'unknown', business_owner: '',
  technical_owner: '', environment: '', data_sensitivity: '', tags: '',
};

function RegisterAssetModal({ open, onClose }) {
  const createAsset = useCreateAiAsset();
  const createAudit = useCreateAuditEvent();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.display_name.trim()) { setError('Display name is required.'); return; }
    if (!form.asset_type) { setError('Asset type is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const data = {
        display_name: form.display_name.trim(),
        name: form.name.trim() || form.display_name.trim().toLowerCase().replace(/\s+/g, '_'),
        asset_type: form.asset_type,
        provider: form.provider.trim() || undefined,
        description: form.description.trim() || undefined,
        risk_level: form.risk_level || 'unknown',
        lifecycle_stage: form.lifecycle_stage || 'unknown',
        business_owner: form.business_owner.trim() || undefined,
        technical_owner: form.technical_owner.trim() || undefined,
        environment: form.environment.trim() || undefined,
        data_sensitivity: form.data_sensitivity || undefined,
        tags: tags.length ? tags : undefined,
        status: 'active',
        review_status: 'pending',
        confidence_score: 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      };
      const created = await createAsset.mutateAsync(data);
      await createAudit.mutateAsync({
        action: 'asset_registered',
        resource_type: 'ai_asset',
        resource_id: created.id,
        result: 'success',
        details: { display_name: data.display_name, method: 'manual' },
      });
      setForm(EMPTY_FORM);
      onClose(created.id);
    } catch (e) {
      setError(e?.message || 'Failed to create asset.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register AI Asset</DialogTitle>
          <DialogDescription>Manually add an AI asset to the inventory.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {/* Display Name */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="reg-display-name">Display Name <span className="text-red-500">*</span></Label>
            <Input id="reg-display-name" placeholder="e.g. GitHub Copilot Enterprise" value={form.display_name} onChange={(e) => set('display_name', e.target.value)} />
          </div>

          {/* Asset Type */}
          <div className="space-y-1.5">
            <Label>Asset Type <span className="text-red-500">*</span></Label>
            <Select value={form.asset_type} onValueChange={(v) => set('asset_type', v)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-provider">Provider</Label>
            <Input id="reg-provider" placeholder="e.g. GitHub, OpenAI" value={form.provider} onChange={(e) => set('provider', e.target.value)} />
          </div>

          {/* Risk Level */}
          <div className="space-y-1.5">
            <Label>Risk Level</Label>
            <Select value={form.risk_level} onValueChange={(v) => set('risk_level', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RISK_LEVEL_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lifecycle Stage */}
          <div className="space-y-1.5">
            <Label>Lifecycle Stage</Label>
            <Select value={form.lifecycle_stage} onValueChange={(v) => set('lifecycle_stage', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LIFECYCLE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Sensitivity */}
          <div className="space-y-1.5">
            <Label>Data Sensitivity</Label>
            <Select value={form.data_sensitivity} onValueChange={(v) => set('data_sensitivity', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {Object.entries(DATA_SENSITIVITY_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Environment */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-env">Environment</Label>
            <Input id="reg-env" placeholder="e.g. production, staging" value={form.environment} onChange={(e) => set('environment', e.target.value)} />
          </div>

          {/* Business Owner */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-biz">Business Owner</Label>
            <Input id="reg-biz" placeholder="Name or team" value={form.business_owner} onChange={(e) => set('business_owner', e.target.value)} />
          </div>

          {/* Technical Owner */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-tech">Technical Owner</Label>
            <Input id="reg-tech" placeholder="Name or team" value={form.technical_owner} onChange={(e) => set('technical_owner', e.target.value)} />
          </div>

          {/* Description */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="reg-desc">Description</Label>
            <textarea
              id="reg-desc"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Brief description of this AI asset…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="reg-tags">Tags <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
            <Input id="reg-tags" placeholder="e.g. coding, productivity, security" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          </div>

          {error && (
            <div className="sm:col-span-2 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Plus className="h-4 w-4" />}
            Register Asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { feature } = useNav();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: assets = [], isLoading } = useAiAssets();
  const { data: sources = [] } = useDiscoverySources();
  const bulkUpdate = useBulkUpdateAiAssets();
  const deleteAsset = useDeleteAiAsset();
  const createAudit = useCreateAuditEvent();

  // View / filter / sort state
  const [view, setView] = useState('card');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [sort, setSort] = useState('-last_seen');
  const [kpiFilter, setKpiFilter] = useState(null); // null | 'all' | 'confirmed' | 'high_risk' | 'critical' | 'pending'

  // Bulk state
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState([]);

  // Modal state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Dynamic provider list
  const providers = useMemo(() => {
    const set = new Set(assets.map((a) => a.provider).filter(Boolean));
    return Array.from(set).sort();
  }, [assets]);

  // KPI counts
  const kpi = useMemo(() => ({
    total: assets.length,
    active: assets.filter((a) => a.status === 'active').length,
    confirmed: assets.filter((a) => a.review_status === 'confirmed').length,
    highRisk: assets.filter((a) => a.risk_level === 'high' || a.risk_level === 'critical').length,
    critical: assets.filter((a) => a.risk_level === 'critical').length,
    pending: assets.filter((a) => !a.review_status || a.review_status === 'pending').length,
  }), [assets]);

  // Filtered + sorted assets
  const filtered = useMemo(() => {
    let result = [...assets];

    // KPI quick-filter
    if (kpiFilter === 'confirmed') result = result.filter((a) => a.review_status === 'confirmed');
    else if (kpiFilter === 'high_risk') result = result.filter((a) => a.risk_level === 'high' || a.risk_level === 'critical');
    else if (kpiFilter === 'critical') result = result.filter((a) => a.risk_level === 'critical');
    else if (kpiFilter === 'pending') result = result.filter((a) => !a.review_status || a.review_status === 'pending');
    else if (kpiFilter === 'active') result = result.filter((a) => a.status === 'active');

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.display_name || '').toLowerCase().includes(q) ||
        (a.provider || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.business_owner || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') result = result.filter((a) => a.asset_type === typeFilter);
    if (providerFilter !== 'all') result = result.filter((a) => a.provider === providerFilter);
    if (riskFilter !== 'all') result = result.filter((a) => (a.risk_level || 'unknown') === riskFilter);
    if (reviewFilter !== 'all') result = result.filter((a) => (a.review_status || 'pending') === reviewFilter);
    if (lifecycleFilter !== 'all') result = result.filter((a) => (a.lifecycle_stage || 'unknown') === lifecycleFilter);
    if (confidenceFilter !== 'all') {
      result = result.filter((a) => {
        const level = (a.confidence_score || 0) >= 0.75 ? 'high' : (a.confidence_score || 0) >= 0.5 ? 'medium' : 'low';
        return level === confidenceFilter;
      });
    }

    const dir = sort.startsWith('-') ? -1 : 1;
    const key = sort.replace(/^-/, '');
    result.sort((a, b) => {
      if (key === 'last_seen') return dir * (new Date(b.last_seen || b.created_date) - new Date(a.last_seen || a.created_date));
      if (key === 'name') return dir * (a.display_name || a.name || '').localeCompare(b.display_name || b.name || '');
      if (key === 'confidence') return dir * ((b.confidence_score || 0) - (a.confidence_score || 0));
      if (key === 'risk') {
        const order = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
        return dir * ((order[b.risk_level] || 0) - (order[a.risk_level] || 0));
      }
      if (key === 'created_date') return dir * (new Date(b.created_date) - new Date(a.created_date));
      return 0;
    });
    return result;
  }, [assets, search, typeFilter, providerFilter, riskFilter, reviewFilter, lifecycleFilter, confidenceFilter, sort, kpiFilter]);

  const hasActiveFilters = search || typeFilter !== 'all' || providerFilter !== 'all' || riskFilter !== 'all' || reviewFilter !== 'all' || lifecycleFilter !== 'all' || confidenceFilter !== 'all' || kpiFilter;

  const clearFilters = () => {
    setSearch(''); setTypeFilter('all'); setProviderFilter('all'); setRiskFilter('all');
    setReviewFilter('all'); setLifecycleFilter('all'); setConfidenceFilter('all'); setKpiFilter(null);
  };

  const openProfile = (id) => navigate('/user/setup/ai-discovery/ai-profile?asset=' + id);

  // Bulk operations
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const toggleBulkMode = () => {
    setBulkMode((b) => !b);
    setSelected([]);
  };

  const selectAll = () => setSelected(filtered.map((a) => a.id));
  const deselectAll = () => setSelected([]);

  const handleBulkReview = async (status) => {
    if (!selected.length) return;
    await bulkUpdate.mutateAsync({ ids: selected, data: { review_status: status, reviewed_at: new Date().toISOString() } });
    await createAudit.mutateAsync({ action: 'bulk_review', resource_type: 'ai_asset', result: 'success', details: { ids: selected, review_status: status } });
    deselectAll();
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    for (const id of selected) await deleteAsset.mutateAsync(id);
    await createAudit.mutateAsync({ action: 'bulk_delete', resource_type: 'ai_asset', result: 'success', details: { count: selected.length } });
    setDeleteConfirm(false);
    deselectAll();
  };

  const setKpi = (key) => setKpiFilter((prev) => prev === key ? null : key);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <feature.icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{t(feature.name)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t(feature.desc)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={bulkMode ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={toggleBulkMode}
          >
            <Check className="h-3.5 w-3.5" />
            {bulkMode ? 'Exit Bulk' : 'Bulk Select'}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Asset
          </Button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total Assets" value={kpi.total} icon={Boxes} onClick={() => setKpi('total')} active={kpiFilter === 'total'} />
        <KpiCard label="Active" value={kpi.active} icon={Activity} color="text-emerald-600 dark:text-emerald-400" onClick={() => setKpi('active')} active={kpiFilter === 'active'} />
        <KpiCard label="Confirmed" value={kpi.confirmed} icon={Check} color="text-emerald-600 dark:text-emerald-400" onClick={() => setKpi('confirmed')} active={kpiFilter === 'confirmed'} />
        <KpiCard label="High Risk" value={kpi.highRisk} icon={AlertTriangle} color="text-orange-600 dark:text-orange-400" onClick={() => setKpi('high_risk')} active={kpiFilter === 'high_risk'} />
        <KpiCard label="Critical" value={kpi.critical} icon={AlertCircle} color="text-red-600 dark:text-red-400" onClick={() => setKpi('critical')} active={kpiFilter === 'critical'} />
        <KpiCard label="Pending Review" value={kpi.pending} icon={Flag} color="text-amber-600 dark:text-amber-400" onClick={() => setKpi('pending')} active={kpiFilter === 'pending'} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card p-1">
          <ViewToggle active={view === 'card'} onClick={() => setView('card')} icon={LayoutGrid} label="Card" />
          <ViewToggle active={view === 'table'} onClick={() => setView('table')} icon={TableIcon} label="Table" />
          <ViewToggle active={view === 'list'} onClick={() => setView('list')} icon={List} label="List" />
        </div>

        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets, owners, providers…" className="pl-9" />
        </div>

        {/* Filters */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Providers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map((p) => <SelectItem key={p} value={p}><span className="capitalize">{p}</span></SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="All Risk" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk</SelectItem>
            {Object.entries(RISK_LEVEL_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-[145px]"><SelectValue placeholder="All Reviews" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reviews</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="needs_review">Needs Review</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
          <SelectTrigger className="w-[135px]"><SelectValue placeholder="All Lifecycle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lifecycle</SelectItem>
            {Object.entries(LIFECYCLE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[145px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="-last_seen">Last Seen</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="-confidence">Confidence ↓</SelectItem>
            <SelectItem value="-risk">Risk ↓</SelectItem>
            <SelectItem value="-created_date">Newest First</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Bulk select-all row */}
      {bulkMode && filtered.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
          <button className="font-medium text-primary hover:underline" onClick={selectAll}>
            Select all {filtered.length}
          </button>
          {selected.length > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <button className="text-muted-foreground hover:text-foreground" onClick={deselectAll}>Deselect all</button>
              <span className="ml-auto font-semibold text-primary">{selected.length} selected</span>
            </>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'asset' : 'assets'}`}
          {hasActiveFilters && !isLoading && ` of ${assets.length} total`}
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card py-16 text-center shadow-sm">
          <Boxes className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium text-foreground">
            {assets.length === 0 ? 'No AI assets discovered yet' : 'No assets match your filters'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {assets.length === 0
              ? 'Run detection on an AI Source to find AI assets automatically.'
              : 'Try adjusting or clearing your active filters.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            {assets.length === 0 ? (
              <Button size="sm" className="gap-1.5" onClick={() => navigate('/user/setup/ai-discovery/ai-detection')}>
                <ScanSearch className="h-3.5 w-3.5" /> Go to AI Detection
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear Filters
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRegisterOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Manually
            </Button>
          </div>
        </div>
      ) : view === 'card' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onOpen={() => openProfile(asset.id)}
              bulkMode={bulkMode}
              selected={selected}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-left text-xs uppercase tracking-wider">
                {bulkMode && (
                  <th className="px-4 py-3 w-8">
                    <button
                      className={cn('h-4 w-4 rounded border-2 flex items-center justify-center', selected.length === filtered.length ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70')}
                      onClick={selected.length === filtered.length ? deselectAll : selectAll}
                    >
                      {selected.length === filtered.length && <Check className="h-2.5 w-2.5" />}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 font-medium">
                  <SortHeader label="Asset" field="name" sort={sort} onSort={setSort} />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Provider</th>
                <th className="px-4 py-3 font-medium">
                  <SortHeader label="Risk" field="risk" sort={sort} onSort={setSort} />
                </th>
                <th className="px-4 py-3 font-medium">
                  <SortHeader label="Confidence" field="confidence" sort={sort} onSort={setSort} />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Review</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Lifecycle</th>
                <th className="px-4 py-3 font-medium">
                  <SortHeader label="Last Seen" field="last_seen" sort={sort} onSort={setSort} />
                </th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset) => {
                const confLevel = (asset.confidence_score || 0) >= 0.75 ? 'high' : (asset.confidence_score || 0) >= 0.5 ? 'medium' : 'low';
                return (
                  <tr
                    key={asset.id}
                    className={cn('cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors', selected.includes(asset.id) && 'bg-primary/5')}
                    onClick={() => bulkMode ? toggleSelect(asset.id) : openProfile(asset.id)}
                  >
                    {bulkMode && (
                      <td className="px-4 py-3">
                        <div className={cn('h-4 w-4 rounded border-2 flex items-center justify-center', selected.includes(asset.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70')}>
                          {selected.includes(asset.id) && <Check className="h-2.5 w-2.5" />}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <AssetTypeIcon type={asset.asset_type} size="sm" />
                        <div>
                          <p className="font-medium text-foreground">{asset.display_name || asset.name}</p>
                          {asset.business_owner && <p className="text-xs text-muted-foreground">{asset.business_owner}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}</td>
                    <td className="px-4 py-3"><ProviderBadge provider={asset.provider} /></td>
                    <td className="px-4 py-3"><RiskBadge level={asset.risk_level} /></td>
                    <td className="px-4 py-3"><ConfidenceBadge level={confLevel} score={asset.confidence_score} /></td>
                    <td className="px-4 py-3"><ReviewBadge status={asset.review_status} /></td>
                    <td className="px-4 py-3">{asset.lifecycle_stage ? <LifecycleBadge stage={asset.lifecycle_stage} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatRelative(asset.last_seen || asset.created_date)}</td>
                    <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filtered.map((asset) => {
            const confLevel = (asset.confidence_score || 0) >= 0.75 ? 'high' : (asset.confidence_score || 0) >= 0.5 ? 'medium' : 'low';
            return (
              <button
                key={asset.id}
                className={cn('flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/20', selected.includes(asset.id) ? 'border-primary/60 bg-primary/5' : 'border-border/70')}
                onClick={() => bulkMode ? toggleSelect(asset.id) : openProfile(asset.id)}
              >
                {bulkMode && (
                  <div className={cn('h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center', selected.includes(asset.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70')}>
                    {selected.includes(asset.id) && <Check className="h-2.5 w-2.5" />}
                  </div>
                )}
                <AssetTypeIcon type={asset.asset_type} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{asset.display_name || asset.name}</p>
                  <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type} · <span className="capitalize">{asset.provider}</span></p>
                </div>
                <RiskBadge level={asset.risk_level} />
                <ConfidenceBadge level={confLevel} score={asset.confidence_score} />
                <ReviewBadge status={asset.review_status} />
                <span className="hidden text-xs text-muted-foreground sm:block whitespace-nowrap">{formatRelative(asset.last_seen || asset.created_date)}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk bar */}
      {bulkMode && selected.length > 0 && (
        <BulkBar
          selected={selected}
          onDeselect={deselectAll}
          onBulkAction={handleBulkReview}
          onDelete={() => setDeleteConfirm(true)}
        />
      )}

      {/* Manual registration modal */}
      <RegisterAssetModal
        open={registerOpen}
        onClose={(newId) => {
          setRegisterOpen(false);
          if (newId) openProfile(newId);
        }}
      />

      {/* Bulk delete confirm */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.length} asset{selected.length > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected AI assets from the inventory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleBulkDelete}>
              Delete {selected.length} {selected.length === 1 ? 'asset' : 'assets'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}