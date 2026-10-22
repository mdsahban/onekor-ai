import { useState, useMemo } from 'react';
import { useNav } from '@/components/layout/AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { useNavigate } from 'react-router-dom';
import { pathFor } from '@/lib/navigation';
import {
  useDiscoverySources, useRunDiscovery, useTestConnection, useUpdateSource,
  useDeleteSource, useCreateSource, useCreateAuditEvent,
} from '@/lib/discovery/hooks';
import { CONNECTORS } from '@/lib/discovery/connectors';
import { CONNECTION_STATUS_META } from '@/lib/discovery/helpers';
import SourceCard from '@/components/discovery/SourceCard';
import SourceTable from '@/components/discovery/SourceTable';
import RunDiscoveryDialog from '@/components/discovery/RunDiscoveryDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  LayoutGrid, List, Search, Plus, Plug, Loader2, AlertCircle,
  AlertTriangle, Play, Power, Trash2, X, CheckCircle2, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Status summary strip ────────────────────────────────────────────
function StatusStrip({ sources }) {
  const connected = sources.filter((s) => s.connection_status === 'connected' && s.enabled !== false).length;
  const disconnected = sources.filter((s) =>
    ['error', 'authentication_failed', 'permission_denied', 'rate_limited'].includes(s.connection_status)
  ).length;
  const disabled = sources.filter((s) => s.enabled === false).length;
  const totalAssets = sources.reduce((sum, s) => sum + (s.assets_discovered || 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
      {[
        { label: 'Connected', value: connected, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', dot: 'bg-emerald-500' },
        { label: 'Need Attention', value: disconnected, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500' },
        { label: 'Disabled', value: disabled, color: 'text-muted-foreground', bg: 'bg-muted/40', dot: 'bg-muted-foreground' },
        { label: 'Assets Found', value: totalAssets.toLocaleString(), color: 'text-foreground', bg: 'bg-card', dot: null, border: true },
      ].map(({ label, value, color, bg, dot, border }) => (
        <div key={label} className={cn('flex items-center gap-3 rounded-xl px-4 py-3', bg, border && 'border border-border/70')}>
          {dot && <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />}
          {!dot && <Activity className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-lg font-semibold leading-tight', color)}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Attention banner ────────────────────────────────────────────────
function AttentionBanner({ sources, onOpenSource }) {
  const attention = sources.filter((s) =>
    ['error', 'authentication_failed', 'permission_denied', 'rate_limited'].includes(s.connection_status)
  );
  if (!attention.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {attention.length} source{attention.length > 1 ? 's need' : ' needs'} attention
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {attention.map((s) => {
              const m = CONNECTION_STATUS_META[s.connection_status];
              return (
                <button
                  key={s.id}
                  onClick={() => onOpenSource(s)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors dark:bg-amber-900/40 dark:text-amber-300"
                >
                  {s.name}
                  <span className="text-amber-500/70">·</span>
                  {m?.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk action bar ─────────────────────────────────────────────────
function BulkBar({ selectedIds, sources, onRunAll, onEnableAll, onDisableAll, onDeleteAll, onClear, running }) {
  const count = selectedIds.size;
  if (count === 0) return null;
  const selectedSources = sources.filter((s) => selectedIds.has(s.id));
  return (
    <div className="sticky top-2 z-20 mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-background/95 px-4 py-2.5 shadow-md backdrop-blur ring-1 ring-primary/10">
      <span className="text-sm font-medium text-foreground">
        <span className="text-primary font-bold">{count}</span> selected
      </span>
      <div className="h-4 w-px bg-border" />
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onRunAll(selectedSources)} disabled={running}>
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Run All
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEnableAll(selectedSources)}>
        <Power className="h-3.5 w-3.5" /> Enable
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onDisableAll(selectedSources)}>
        <Power className="h-3.5 w-3.5" /> Disable
      </Button>
      <Button
        size="sm" variant="outline"
        className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
        onClick={() => onDeleteAll(selectedSources)}
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
      <Button size="sm" variant="ghost" className="ml-auto h-7 w-7 p-0" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Sort util ───────────────────────────────────────────────────────
function applySortFilter(sources, sortCol, sortDir) {
  return [...sources].sort((a, b) => {
    let aVal, bVal;
    switch (sortCol) {
      case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
      case 'connector': aVal = a.connector_id; bVal = b.connector_id; break;
      case 'status': aVal = a.connection_status; bVal = b.connection_status; break;
      case 'last_scan': aVal = a.last_successful_scan || a.last_scan_at || ''; bVal = b.last_successful_scan || b.last_scan_at || ''; break;
      case 'assets': aVal = a.assets_discovered || 0; bVal = b.assets_discovered || 0; break;
      case 'schedule': aVal = a.scan_frequency; bVal = b.scan_frequency; break;
      default: aVal = a.name; bVal = b.name;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ─── Page ────────────────────────────────────────────────────────────
export default function AiSourcesPage() {
  const { panel, area, mod, feature } = useNav();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: sources = [], isLoading } = useDiscoverySources();
  const runDiscovery = useRunDiscovery();
  const testConnection = useTestConnection();
  const updateSource = useUpdateSource();
  const deleteSource = useDeleteSource();
  const createSource = useCreateSource();
  const createAudit = useCreateAuditEvent();

  // UI state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [connectorFilter, setConnectorFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Dialogs
  const [runDialog, setRunDialog] = useState({ open: false, runId: null, sourceName: '', sourceId: null });
  const [deleteTarget, setDeleteTarget] = useState(null); // single source or array for bulk
  const [testResult, setTestResult] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...sources];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.connector_id || '').toLowerCase().includes(q) ||
        (s.config?.environment || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter((s) => s.connection_status === statusFilter);
    if (connectorFilter !== 'all') result = result.filter((s) => s.connector_id === connectorFilter);
    return applySortFilter(result, sortCol, sortDir);
  }, [sources, search, statusFilter, connectorFilter, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // Navigation
  const openSource = (source, tab) => {
    const url = pathFor(panel.id, area.id, mod.id, 'ai-sources') +
      (tab === 'logs' ? `?source=${source.id}&tab=logs` : `?source=${source.id}`);
    navigate(url);
  };

  // Selection
  const handleSelectOne = (source, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(source.id) : next.delete(source.id);
      return next;
    });
  };
  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? new Set(filtered.map((s) => s.id)) : new Set());
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Single actions
  const handleRun = async (source) => {
    try {
      const result = await runDiscovery.mutateAsync(source.id);
      setRunDialog({ open: true, runId: result?.run_id, sourceName: source.name, sourceId: source.id });
      await createAudit.mutateAsync({ action: 'discovery_started', resource_type: 'discovery_source', resource_id: source.id, result: 'success' });
    } catch {
      setRunDialog({ open: true, runId: null, sourceName: source.name, sourceId: source.id });
    }
  };

  const handleTest = async (source) => {
    setTestingId(source.id);
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({ sourceId: source.id });
      setTestResult(result);
      await updateSource.mutateAsync({ id: source.id, data: { connection_status: result.ok ? 'connected' : result.status } });
      await createAudit.mutateAsync({ action: 'connection_tested', resource_type: 'discovery_source', resource_id: source.id, result: result.ok ? 'success' : 'failure' });
    } catch (err) {
      setTestResult({ ok: false, status: 'error', error: err.message, steps: [] });
    }
    setTestingId(null);
  };

  const handleToggle = async (source) => {
    const newEnabled = !source.enabled;
    await updateSource.mutateAsync({ id: source.id, data: { enabled: newEnabled, connection_status: newEnabled ? source.connection_status : 'disabled' } });
    await createAudit.mutateAsync({ action: newEnabled ? 'source_enabled' : 'source_disabled', resource_type: 'discovery_source', resource_id: source.id, result: 'success' });
  };

  const handleDuplicate = async (source) => {
    const { id, created_date, updated_date, ...rest } = source;
    await createSource.mutateAsync({ ...rest, name: `${source.name} (Copy)`, connection_status: 'not_configured', last_scan_at: null, last_successful_scan: null, assets_discovered: 0, new_assets: 0, updated_assets: 0, errors_count: 0 });
    await createAudit.mutateAsync({ action: 'source_created', resource_type: 'discovery_source', resource_id: null, result: 'success', details: { name: `${source.name} (Copy)` } });
  };

  const handleDelete = async () => {
    if (Array.isArray(deleteTarget)) {
      setBulkDeletePending(true);
      for (const s of deleteTarget) {
        await deleteSource.mutateAsync(s.id);
        await createAudit.mutateAsync({ action: 'source_deleted', resource_type: 'discovery_source', resource_id: s.id, result: 'success' });
      }
      clearSelection();
      setBulkDeletePending(false);
    } else if (deleteTarget) {
      await deleteSource.mutateAsync(deleteTarget.id);
      await createAudit.mutateAsync({ action: 'source_deleted', resource_type: 'discovery_source', resource_id: deleteTarget.id, result: 'success' });
    }
    setDeleteTarget(null);
  };

  const handleEdit = (source) => {
    navigate(pathFor(panel.id, area.id, mod.id, 'connectors') + `?connector=${source.connector_id}`);
  };

  // Bulk ops
  const handleBulkRun = async (srcs) => {
    setBulkRunning(true);
    for (const s of srcs.filter((s) => s.enabled && s.connection_status === 'connected')) {
      await handleRun(s);
    }
    setBulkRunning(false);
    clearSelection();
  };
  const handleBulkEnable = async (srcs) => {
    for (const s of srcs) await updateSource.mutateAsync({ id: s.id, data: { enabled: true } });
    clearSelection();
  };
  const handleBulkDisable = async (srcs) => {
    for (const s of srcs) await updateSource.mutateAsync({ id: s.id, data: { enabled: false, connection_status: 'disabled' } });
    clearSelection();
  };
  const handleBulkDelete = (srcs) => setDeleteTarget(srcs);

  const runningIds = runDiscovery.isPending ? [runDiscovery.variables] : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <feature.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{t(feature.name)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t(feature.desc)}</p>
          </div>
        </div>
        <Button onClick={() => navigate(pathFor(panel.id, area.id, mod.id, 'connectors'))} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Source
        </Button>
      </div>

      {/* Empty state */}
      {sources.length === 0 && !isLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Plug className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-xl font-semibold text-foreground">No AI sources connected yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect a source from the Connector Directory to start discovering AI assets across your organization.
            </p>
            <Button onClick={() => navigate(pathFor(panel.id, area.id, mod.id, 'connectors'))} className="mt-5 gap-2">
              <Plus className="h-4 w-4" /> Browse Connectors
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Status summary */}
          {sources.length > 0 && <StatusStrip sources={sources} />}

          {/* Attention banner */}
          <AttentionBanner sources={sources} onOpenSource={openSource} />

          {/* Bulk bar */}
          <BulkBar
            selectedIds={selectedIds}
            sources={sources}
            onRunAll={handleBulkRun}
            onEnableAll={handleBulkEnable}
            onDisableAll={handleBulkDisable}
            onDeleteAll={handleBulkDelete}
            onClear={clearSelection}
            running={bulkRunning}
          />

          {/* Filter bar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sources…" className="pl-9" />
            </div>
            <Select value={connectorFilter} onValueChange={setConnectorFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Connectors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Connectors</SelectItem>
                {CONNECTORS.filter((c) => sources.some((s) => s.connector_id === c.id)).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(CONNECTION_STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-lg border border-border">
              <button onClick={() => setView('grid')} className={cn('grid h-9 w-9 place-items-center rounded-l-lg', view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setView('list')} className={cn('grid h-9 w-9 place-items-center rounded-r-lg border-l border-border', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
                <List className="h-4 w-4" />
              </button>
            </div>
            {(search || statusFilter !== 'all' || connectorFilter !== 'all') && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => { setSearch(''); setStatusFilter('all'); setConnectorFilter('all'); }}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground">No sources match your filters.</div>
          ) : view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  selected={selectedIds.has(source.id)}
                  onSelect={handleSelectOne}
                  onOpen={openSource}
                  onRun={handleRun}
                  onTest={handleTest}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  onDuplicate={handleDuplicate}
                  onDelete={(s) => setDeleteTarget(s)}
                  testing={testingId === source.id}
                  running={runningIds.includes(source.id) || bulkRunning}
                />
              ))}
            </div>
          ) : (
            <SourceTable
              sources={filtered}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelectOne={handleSelectOne}
              onOpen={openSource}
              onRun={handleRun}
              onTest={handleTest}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDuplicate={handleDuplicate}
              onDelete={(s) => setDeleteTarget(s)}
              runningIds={runningIds}
              testingIds={testingId ? [testingId] : []}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}

          {/* Footer count */}
          {filtered.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground text-right">
              {filtered.length} of {sources.length} sources
              {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
            </p>
          )}
        </>
      )}

      {/* Run dialog */}
      <RunDiscoveryDialog
        open={runDialog.open}
        onOpenChange={(open) => setRunDialog((prev) => ({ ...prev, open }))}
        runId={runDialog.runId}
        sourceName={runDialog.sourceName}
        onViewLogs={() => {
          setRunDialog((prev) => ({ ...prev, open: false }));
          const source = sources.find((s) => s.id === runDialog.sourceId);
          if (source) openSource(source, 'logs');
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {Array.isArray(deleteTarget)
                ? `Delete ${deleteTarget.length} sources?`
                : `Delete "${deleteTarget?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the connection and stops future discovery runs.
              Historical discovery evidence and AI assets will remain for audit purposes.
              {Array.isArray(deleteTarget) && deleteTarget.length > 1 && (
                <span className="mt-2 block font-medium text-foreground">
                  Sources: {deleteTarget.map((s) => s.name).join(', ')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkDeletePending}
            >
              {bulkDeletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {Array.isArray(deleteTarget) ? `Delete ${deleteTarget.length} Sources` : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test result dialog */}
      <Dialog open={!!testResult} onOpenChange={(open) => !open && setTestResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {testResult?.ok
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                : <AlertCircle className="h-5 w-5 text-red-600" />
              }
              Connection Test Result
            </DialogTitle>
            <DialogDescription>{testResult?.message || testResult?.error}</DialogDescription>
          </DialogHeader>
          {testResult?.steps?.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
              {testResult.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={cn('h-2 w-2 rounded-full', s.ok || s.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500')} />
                  <span className="text-foreground">{s.message}</span>
                  {s.latency_ms && <span className="ml-auto text-xs text-muted-foreground">{s.latency_ms}ms</span>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}