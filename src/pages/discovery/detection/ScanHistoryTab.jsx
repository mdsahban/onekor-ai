import { useState, useMemo } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import {
  useScans, useScanControl, useRunScan, useScanTemplates,
  useDetectionProfiles, useScanLogs, useDeleteScan,
} from '@/lib/discovery/scan-hooks';
import { useDiscoverySources } from '@/lib/discovery/hooks';
import { formatRelative, formatDateTime } from '@/lib/discovery/helpers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Activity, Play, Pause, Square, RotateCcw, FileText, Loader2, Plus, Search,
  CheckCircle2, XCircle, AlertTriangle, Clock, Layers, ChevronDown, ChevronRight,
  RefreshCw, Trash2, ArrowRight, ExternalLink, Terminal, ShieldAlert, Zap,
  BarChart2, Boxes, Crosshair, Filter, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_META = {
  queued: { label: 'Queued', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  running: { label: 'Running', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', dot: 'bg-sky-500 animate-ping' },
  paused: { label: 'Paused', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  completed: { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  partially_completed: { label: 'Partial', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  failed: { label: 'Failed', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', dot: 'bg-muted-foreground' },
};

const SEVERITY_META = {
  info: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  warn: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  error: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  debug: { color: 'text-muted-foreground', bg: 'bg-muted' },
  critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/20' },
};

export default function ScanHistoryTab({ onNavigateOutput }) {
  const { t } = useLanguage();
  const { data: scans = [], isLoading, refetch, isFetching } = useScans();
  const { data: templates = [] } = useScanTemplates();
  const { data: sources = [] } = useDiscoverySources();
  const { data: profiles = [] } = useDetectionProfiles();
  const runScan = useRunScan();
  const deleteScan = useDeleteScan();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedScanId, setExpandedScanId] = useState(null);
  const [runOpen, setRunOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filtered scans
  const filtered = useMemo(() => {
    return scans.filter((scan) => {
      if (statusFilter !== 'all' && scan.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (scan.template_name || '').toLowerCase().includes(q);
        const idMatch = (scan.id || '').toLowerCase().includes(q);
        const srcMatch = (scan.current_source || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !srcMatch) return false;
      }
      return true;
    });
  }, [scans, statusFilter, search]);

  // High-level statistics
  const stats = useMemo(() => {
    const total = scans.length;
    const running = scans.filter((s) => ['running', 'queued', 'paused'].includes(s.status)).length;
    const completed = scans.filter((s) => s.status === 'completed').length;
    const failed = scans.filter((s) => ['failed', 'partially_completed'].includes(s.status)).length;
    const totalFindings = scans.reduce((acc, s) => acc + (s.findings_count || 0), 0);
    return { total, running, completed, failed, totalFindings };
  }, [scans]);

  const handleRun = async () => {
    if (!selectedTemplate) return;
    await runScan.mutateAsync({ templateId: selectedTemplate });
    setRunOpen(false);
    setSelectedTemplate('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteScan.mutateAsync(deleteTarget.id);
    if (expandedScanId === deleteTarget.id) setExpandedScanId(null);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Scans</span>
            <Activity className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-sky-50/20 dark:bg-sky-950/10 p-4 shadow-sm">
          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
            <span className="text-xs font-medium uppercase tracking-wider">Active</span>
            <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-ping" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">{stats.running}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-50/20 dark:bg-red-950/10 p-4 shadow-sm">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400">
            <span className="text-xs font-medium uppercase tracking-wider">Failures/Warns</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">{stats.failed}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Findings</span>
            <Crosshair className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.totalFindings}</p>
        </div>
      </div>

      {/* ─── Controls & Filters ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by profile or source name…"
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="partially_completed">Partial</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => refetch()}
            title="Refresh history"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button className="gap-2 h-9" onClick={() => setRunOpen(true)}>
            <Play className="h-4 w-4" /> Run Scan
          </Button>
        </div>
      </div>

      {/* ─── History List / Table ─── */}
      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card py-16 text-center">
          <Activity className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No scan executions found</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            {scans.length === 0
              ? 'Execute a Scan Profile to start discovering AI assets, frameworks, and APIs.'
              : 'No scans match your current filter criteria.'}
          </p>
          {scans.length === 0 && (
            <Button className="mt-4 gap-2" onClick={() => setRunOpen(true)}>
              <Play className="h-4 w-4" /> Run First Scan
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((scan) => {
            const isExpanded = expandedScanId === scan.id;
            return (
              <ScanHistoryCard
                key={scan.id}
                scan={scan}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedScanId(isExpanded ? null : scan.id)}
                onNavigateOutput={() => onNavigateOutput?.(scan.id)}
                onDelete={() => setDeleteTarget(scan)}
                sourcesMap={sources}
                profilesMap={profiles}
              />
            );
          })}
        </div>
      )}

      {/* ─── Run Scan Dialog ─── */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" /> Run Scan Profile
            </DialogTitle>
            <DialogDescription>
              Select a configured Scan Profile to execute immediately. All configured AI Sources will be scanned using the designated Detection Profiles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No Scan Profiles configured yet. Create a Scan Profile in the "Scan Profiles" tab first.
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Select Profile</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a Scan Profile…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.source_ids?.length || 0} sources, {t.profile_ids?.length || 0} profiles)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRun}
              disabled={!selectedTemplate || runScan.isPending}
              className="gap-2"
            >
              {runScan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Execute Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scan Execution?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this scan execution record and its associated operational logs. Discovered AI assets in inventory are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete Scan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Individual Scan History Item ──────────────────────────────────────────
function ScanHistoryCard({
  scan,
  isExpanded,
  onToggleExpand,
  onNavigateOutput,
  onDelete,
  sourcesMap,
  profilesMap,
}) {
  const control = useScanControl();
  const m = STATUS_META[scan.status] || STATUS_META.queued;
  const isActive = ['running', 'queued'].includes(scan.status);
  const isPaused = scan.status === 'paused';
  const isFailed = scan.status === 'failed';
  const isCompleted = ['completed', 'partially_completed'].includes(scan.status);

  // Match sources & profiles
  const attachedSources = (scan.source_ids || []).map((id) => sourcesMap.find((s) => s.id === id) || { id, name: id });
  const attachedProfiles = (scan.profile_ids || []).map((id) => profilesMap.find((p) => p.id === id) || { id, name: id });

  return (
    <div className={cn(
      'rounded-2xl border bg-card transition-all shadow-sm overflow-hidden',
      isExpanded ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border/70 hover:border-border'
    )}>
      {/* Top summary header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={onToggleExpand}
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                {scan.template_name || 'Manual Detection Run'}
              </h3>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border', m.bg, m.color, m.border)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
                {m.label}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {scan.started_at ? formatRelative(scan.started_at) : 'Not started'}
              </span>
              <span>·</span>
              <span>
                {scan.duration_ms ? `${(scan.duration_ms / 1000).toFixed(1)}s` : 'Active'}
              </span>
              <span>·</span>
              <span>{attachedSources.length} source(s)</span>
              <span>·</span>
              <span>{attachedProfiles.length} profile(s)</span>
            </div>
          </div>
        </div>

        {/* Status / Findings Metrics & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
          {/* Findings badges */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">
                {scan.findings_count || 0} <span className="text-xs font-normal text-muted-foreground">findings</span>
              </p>
              <div className="flex items-center gap-1 justify-end">
                {scan.high_confidence_findings > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-600 bg-emerald-500/5 border-emerald-500/20">
                    {scan.high_confidence_findings} high
                  </Badge>
                )}
                {scan.errors_count > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-red-600 bg-red-500/5 border-red-500/20">
                    {scan.errors_count} err
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick buttons */}
          <div className="flex items-center gap-1">
            {isActive && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => control.mutate({ scanId: scan.id, action: 'pause' })}
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            )}
            {isPaused && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs text-sky-600"
                onClick={() => control.mutate({ scanId: scan.id, action: 'resume' })}
              >
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            )}
            {(isActive || isPaused) && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs text-red-600"
                onClick={() => control.mutate({ scanId: scan.id, action: 'stop' })}
              >
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            )}
            {isFailed && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => control.mutate({ scanId: scan.id, action: 'retry' })}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </Button>
            )}

            {isCompleted && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onNavigateOutput}
              >
                View Output <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-red-600"
              onClick={onDelete}
              title="Delete scan record"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Live progress indicator if active */}
      {isActive && (
        <div className="bg-sky-500/5 border-t border-sky-500/10 px-5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>
              Scanning in progress: <strong className="font-semibold">{scan.current_source || 'Initializing…'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-sky-200 dark:bg-sky-950">
              <div
                className="h-full rounded-full bg-sky-600 transition-all duration-300"
                style={{ width: `${scan.progress || 10}%` }}
              />
            </div>
            <span className="font-mono font-medium text-sky-700 dark:text-sky-300">
              {scan.progress || 0}%
            </span>
          </div>
        </div>
      )}

      {/* Expanded Drill-Down Panel */}
      {isExpanded && (
        <div className="border-t border-border/70 bg-muted/15 p-5 space-y-5">
          <ScanDrillDown scan={scan} sources={attachedSources} profiles={attachedProfiles} onNavigateOutput={onNavigateOutput} />
        </div>
      )}
    </div>
  );
}

// ─── Detailed Drill-Down Panel ─────────────────────────────────────────────
function ScanDrillDown({ scan, sources, profiles, onNavigateOutput }) {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [logFilter, setLogFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');

  const { data: logs = [], isLoading: logsLoading } = useScanLogs({
    scanId: scan.id,
    severity: logFilter !== 'all' ? logFilter : undefined,
  });

  const filteredLogs = useMemo(() => {
    if (!logSearch) return logs;
    const q = logSearch.toLowerCase();
    return logs.filter((l) => (l.message || '').toLowerCase().includes(q));
  }, [logs, logSearch]);

  return (
    <div className="space-y-4">
      {/* Subtab navigation */}
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              activeSubTab === 'overview'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            Execution Breakdown
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              activeSubTab === 'logs'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Terminal className="h-3.5 w-3.5" />
            Operational Logs ({logs.length})
          </button>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-7"
          onClick={onNavigateOutput}
        >
          <FileText className="h-3.5 w-3.5" /> View Detection Results
        </Button>
      </div>

      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          {/* Quick Stat Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <span className="text-[11px] text-muted-foreground">Resources Processed</span>
              <p className="mt-1 text-lg font-bold text-foreground">{scan.resources_processed || 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <span className="text-[11px] text-muted-foreground">Findings Detected</span>
              <p className="mt-1 text-lg font-bold text-foreground">{scan.findings_count || 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <span className="text-[11px] text-muted-foreground">High Confidence</span>
              <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {scan.high_confidence_findings || 0}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <span className="text-[11px] text-muted-foreground">Errors / Warnings</span>
              <p className={cn('mt-1 text-lg font-bold', scan.errors_count > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {scan.errors_count || 0}
              </p>
            </div>
          </div>

          {/* Sources and Detection Profiles grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scanned Sources */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-primary" /> Sources Scanned ({sources.length})
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {sources.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-xs">
                    <span className="font-medium text-foreground truncate">{s.name}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                      {s.connector_id || 'source'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Executed Profiles */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-primary" /> Detection Profiles ({profiles.length})
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {profiles.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-xs">
                    <span className="font-medium text-foreground truncate">{p.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {p.category || 'rule'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Error explanation if scan failed */}
          {scan.error_message && (
            <div className="rounded-xl border border-red-500/30 bg-red-50/20 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    Execution Error
                  </h4>
                  <p className="mt-1 text-sm text-foreground font-mono">{scan.error_message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Operational Logs Tab */}
      {activeSubTab === 'logs' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter logs by message…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={logFilter} onValueChange={setLogFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No logs recorded for this scan.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border/60 bg-card p-2 space-y-1 font-mono text-[11px]">
              {filteredLogs.map((log) => {
                const s = SEVERITY_META[log.severity] || SEVERITY_META.info;
                return (
                  <div key={log.id} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-muted/40">
                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0', s.bg, s.color)}>
                      {log.severity}
                    </span>
                    <span className="text-muted-foreground shrink-0">{log.created_date ? formatDateTime(log.created_date).split(' ')[1] : ''}</span>
                    <span className="text-foreground flex-1 break-all">{log.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
