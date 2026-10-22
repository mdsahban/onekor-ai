import { useState, useMemo } from 'react';
import { useNav } from '@/components/layout/AppLayout';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pathFor } from '@/lib/navigation';
import {
  useDiscoverySource, useSourceLogs, useDiscoveryRuns, useUpdateSource,
  useDeleteSource, useRunDiscovery, useTestConnection, useCreateAuditEvent,
} from '@/lib/discovery/hooks';
import { getConnector } from '@/lib/discovery/connectors';
import { ConnectionStatusBadge, RunStatusBadge } from '@/components/discovery/Badges';
import { LOG_SEVERITY_META,
  formatDateTime, formatDuration, formatRelative, formatSchedule,
} from '@/lib/discovery/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Play, Plug, Trash2, Power, PowerOff, Loader2, Check,
  FileText, Settings, ExternalLink, Shield,
  CheckCircle2, XCircle, Search, Eye, Edit2,
  AlertTriangle, BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'configuration', label: 'Configuration', icon: Settings },
  { id: 'discovery', label: 'Discovery', icon: BarChart2 },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

// ─── Config row ────────────────────────────────────────────────────────
function ConfigRow({ label, value, mono }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-medium text-foreground', mono && 'font-mono text-sm')}>{value || '—'}</p>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', color || 'text-foreground')}>{value ?? '—'}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Tab: Overview ─────────────────────────────────────────────────────
function OverviewTab({ source, connector, runs, onRun, onTest, onToggle, running, testing, testResult }) {
  const lastRun = runs[0];
  const successfulRuns = runs.filter((r) => r.status === 'completed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;

  return (
    <div className="space-y-5">
      {/* Test result inline */}
      {testResult && (
        <div className={cn('rounded-xl border p-4', testResult.ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30')}>
          <div className="flex gap-2">
            {testResult.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600" />}
            <div>
              <p className={cn('text-sm font-medium', testResult.ok ? 'text-emerald-900 dark:text-emerald-200' : 'text-red-900 dark:text-red-200')}>
                {testResult.ok ? 'Connection Successful' : 'Connection Failed'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{testResult.message || testResult.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assets Discovered" value={source.assets_discovered?.toLocaleString() ?? 0} sub="total AI assets" color="text-primary" />
        <StatCard label="New (last run)" value={source.new_assets ?? 0} sub="new since last scan" color="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Updated" value={source.updated_assets ?? 0} sub="updated since last scan" color="text-blue-600 dark:text-blue-400" />
        <StatCard
          label="Errors"
          value={source.errors_count ?? 0}
          sub="in last run"
          color={source.errors_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}
        />
      </div>

      {/* Source details */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Source Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <ConfigRow label="Connector" value={connector?.name} />
          <ConfigRow label="Environment" value={source.config?.environment || 'Production'} />
          <ConfigRow label="Schedule" value={formatSchedule(source.scan_frequency)} />
          <ConfigRow label="Status" value={source.enabled !== false ? 'Enabled' : 'Disabled'} />
          <ConfigRow label="Created" value={formatDateTime(source.created_date)} />
          <ConfigRow label="Last Sync" value={formatRelative(source.last_successful_scan || source.last_scan_at)} />
          {source.config?.organization && <ConfigRow label="Organization" value={source.config.organization} />}
          {source.created_by && <ConfigRow label="Created By" value={source.created_by} />}
        </div>
      </div>

      {/* Discovery runs summary */}
      {runs.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Recent Runs</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{successfulRuns} succeeded</span>
              {failedRuns > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{failedRuns} failed</span>}
            </div>
          </div>
          <div className="space-y-2">
            {runs.slice(0, 4).map((run) => (
              <div key={run.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs">
                <RunStatusBadge status={run.status} />
                <span className="text-muted-foreground">{formatDateTime(run.started_at)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{run.findings_created || 0} findings</span>
                {run.duration_ms > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{formatDuration(run.duration_ms)}</span>
                  </>
                )}
                {run.error_message && (
                  <span className="truncate text-red-600 dark:text-red-400 ml-auto max-w-[200px]">{run.error_message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onRun}
          disabled={running || !source.enabled || source.connection_status !== 'connected'}
          className="gap-2"
          id="detail-run-discovery"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Running…' : 'Run Discovery'}
        </Button>
        <Button variant="outline" onClick={onTest} disabled={testing} className="gap-2">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          Test Connection
        </Button>
        <Button variant="outline" onClick={onToggle} className="gap-2">
          {source.enabled !== false ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          {source.enabled !== false ? 'Disable Source' : 'Enable Source'}
        </Button>
        {connector && (
          <Button
            variant="outline"
            onClick={() => window.open(`/user/setup/ai-discovery/connectors?connector=${connector.id}`, '_self')}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View Connector
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Configuration ────────────────────────────────────────────────
function ConfigurationTab({ source, connector, onSaved }) {
  const updateSource = useUpdateSource();
  const createAudit = useCreateAuditEvent();

  const [editing, setEditing] = useState(false);
  const [freq, setFreq] = useState(source.scan_frequency || 'manual');
  const [enabled, setEnabled] = useState(source.enabled !== false);
  const [environment, setEnvironment] = useState(source.config?.environment || 'production');
  const [organization, setOrganization] = useState(source.config?.organization || '');
  const [repositories, setRepositories] = useState((source.config?.repositories || []).join(', '));
  const [branch, setBranch] = useState(source.config?.branch || '');
  const [pathFilter, setPathFilter] = useState(source.config?.path_filter || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newConfig = {
      ...source.config,
      environment,
      organization: organization || undefined,
    };
    if (connector?.id === 'github') {
      newConfig.repositories = repositories.split(',').map((r) => r.trim()).filter(Boolean);
      newConfig.branch = branch || undefined;
      newConfig.path_filter = pathFilter || undefined;
    }
    await updateSource.mutateAsync({ id: source.id, data: { config: newConfig, scan_frequency: freq, enabled } });
    await createAudit.mutateAsync({ action: 'source_updated', resource_type: 'discovery_source', resource_id: source.id, result: 'success' });
    setEditing(false);
    setSaving(false);
    onSaved?.();
  };

  return (
    <div className="space-y-5">
      {/* Connector info */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Connector</h3>
        <div className="flex items-center gap-3">
          {connector && (
            <div className="grid h-10 w-10 place-items-center rounded-xl text-white ring-1 ring-black/10" style={{ backgroundColor: connector.color }}>
              <connector.icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">{connector?.name || source.connector_id}</p>
            <p className="text-xs text-muted-foreground">{connector?.description}</p>
          </div>
        </div>
        {source.credential_reference && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Credential: <span className="font-mono ml-1">{source.credential_reference}</span>
          </div>
        )}
      </div>

      {/* Configuration */}
      {editing ? (
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Edit Configuration</h3>
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
              <Select value={freq} onValueChange={setFreq}>
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

          {connector?.id === 'github' && (
            <>
              <div className="space-y-2">
                <Label>Organization</Label>
                <Input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="my-organization" />
              </div>
              <div className="space-y-2">
                <Label>Repositories (comma-separated)</Label>
                <Textarea value={repositories} onChange={(e) => setRepositories(e.target.value)} placeholder="repo-one, repo-two (empty = all)" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Branch Filter</Label>
                  <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
                </div>
                <div className="space-y-2">
                  <Label>Path Filter</Label>
                  <Input value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} placeholder="src/" />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Source Enabled</p>
              <p className="text-xs text-muted-foreground">Disabled sources are skipped during discovery runs.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Settings</h3>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <ConfigRow label="Environment" value={source.config?.environment || 'Production'} />
            <ConfigRow label="Schedule" value={formatSchedule(source.scan_frequency)} />
            <ConfigRow label="Enabled" value={source.enabled !== false ? 'Yes' : 'No'} />
            {connector?.id === 'github' && (
              <>
                <ConfigRow label="Organization" value={source.config?.organization || 'Personal'} />
                <ConfigRow label="Repositories" value={(source.config?.repositories || []).join(', ') || 'All'} />
                <ConfigRow label="Branch Filter" value={source.config?.branch || 'Default'} />
                <ConfigRow label="Path Filter" value={source.config?.path_filter || 'None'} />
              </>
            )}
            {(connector?.id === 'openai' || connector?.id === 'anthropic') && (
              <>
                <ConfigRow label="Auth" value="API Key (secured)" />
                {source.config?.organization && <ConfigRow label="Organization" value={source.config.organization} />}
                {source.config?.project && <ConfigRow label="Project" value={source.config.project} />}
              </>
            )}
            <ConfigRow label="Created" value={formatDateTime(source.created_date)} />
            <ConfigRow label="Last Updated" value={formatDateTime(source.updated_date)} />
            {source.created_by && <ConfigRow label="Owner" value={source.created_by} />}
          </div>
        </div>
      )}

      {/* Discovery scope */}
      {source.config?.discovery_categories && Object.keys(source.config.discovery_categories).length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Discovery Scope</h3>
          <div className="space-y-1.5">
            {Object.entries(source.config.discovery_categories).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                {v ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                <span className={v ? 'text-foreground' : 'text-muted-foreground line-through'}>
                  {k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Discovery ─────────────────────────────────────────────────────
function DiscoveryTab({ source, runs }) {
  const runDiscovery = useRunDiscovery();
  const createAudit = useCreateAuditEvent();

  const handleRun = async () => {
    await runDiscovery.mutateAsync(source.id);
    await createAudit.mutateAsync({ action: 'discovery_started', resource_type: 'discovery_source', resource_id: source.id, result: 'success' });
  };

  if (!runs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 py-16 text-center">
        <BarChart2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h3 className="mt-4 font-semibold text-foreground">No discovery runs yet</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
          Run discovery to start collecting AI asset evidence from this source.
        </p>
        <Button
          onClick={handleRun}
          disabled={runDiscovery.isPending || !source.enabled || source.connection_status !== 'connected'}
          className="mt-5 gap-2"
        >
          {runDiscovery.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Discovery
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Runs" value={runs.length} />
        <StatCard label="Successful" value={runs.filter((r) => r.status === 'completed').length} color="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Failed" value={runs.filter((r) => r.status === 'failed').length} color={runs.filter((r) => r.status === 'failed').length > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'} />
      </div>

      {/* Run history */}
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border/70 bg-muted/30 px-4 py-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Run History</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Started</th>
              <th className="px-4 py-2.5 font-medium text-center">Findings</th>
              <th className="px-4 py-2.5 font-medium text-center">Duration</th>
              <th className="px-4 py-2.5 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => (
              <tr key={run.id || i} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{formatDateTime(run.started_at)}</td>
                <td className="px-4 py-3 text-center font-semibold text-foreground">{run.findings_created ?? '—'}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">{run.duration_ms > 0 ? formatDuration(run.duration_ms) : '—'}</td>
                <td className="px-4 py-3 max-w-[200px]">
                  {run.error_message ? (
                    <span className="truncate text-xs text-red-600 dark:text-red-400">{run.error_message}</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trigger run */}
      <div className="flex justify-end">
        <Button
          onClick={handleRun}
          disabled={runDiscovery.isPending || !source.enabled || source.connection_status !== 'connected'}
          className="gap-2"
        >
          {runDiscovery.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Discovery Now
        </Button>
      </div>
    </div>
  );
}

// ─── Tab: Logs ─────────────────────────────────────────────────────────
function LogsTab({ source, logs }) {
  const [levelFilter, setLevelFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = [...logs];
    if (levelFilter !== 'all') result = result.filter((l) => (l.severity || l.level) === levelFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) => (l.message || '').toLowerCase().includes(q) || (l.stage || '').toLowerCase().includes(q));
    }
    return result;
  }, [logs, levelFilter, search]);

  if (!source) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs…" className="pl-8 h-8 text-xs" />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">No logs found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search || levelFilter !== 'all' ? 'Try adjusting your filters.' : 'Logs will appear after the first discovery run.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.map((log, i) => {
              const level = log.severity || log.level || 'info';
              const meta = LOG_SEVERITY_META[level] || LOG_SEVERITY_META.info;
              return (
                <div key={log.id || i} className="flex items-start gap-3 border-b border-border/30 px-4 py-3 text-sm last:border-0 hover:bg-muted/20 transition-colors">
                  <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground/60 mt-0.5 w-16">{log.stage || level}</span>
                  <span className={cn('flex-1', level === 'error' ? 'text-red-600 dark:text-red-400' : level === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                    {log.message}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground/50">{formatRelative(log.created_date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">{filtered.length} log {filtered.length === 1 ? 'entry' : 'entries'}</p>
      )}
    </div>
  );
}

// ─── Tab: Danger Zone ─────────────────────────────────────────────────
function DangerZoneTab({ source, connector, onToggle, onDelete }) {
  return (
    <div className="space-y-4">
      {/* Disable / Enable */}
      <div className="rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {source.enabled !== false ? 'Disable Source' : 'Enable Source'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {source.enabled !== false
                ? 'Disabling stops this source from participating in discovery runs. Existing assets and evidence are retained.'
                : 'Enabling allows this source to participate in discovery runs again.'}
            </p>
          </div>
          <Button variant="outline" onClick={onToggle} className="gap-2 shrink-0">
            {source.enabled !== false ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            {source.enabled !== false ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>

      {/* Delete */}
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900 dark:bg-red-950/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Delete Source</h3>
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/80">
              Permanently removes this AI Source and its configuration. Discovery runs will stop.
              Historical AI assets and evidence collected from this source are preserved for audit purposes.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onDelete}
            className="gap-2 shrink-0 border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-4 w-4" /> Delete Source
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────
export default function SourceDetailPage({ sourceId }) {
  const { panel, area, mod } = useNav();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';

  const { data: source, isLoading } = useDiscoverySource(sourceId);
  const { data: logs = [] } = useSourceLogs(sourceId);
  const { data: runs = [] } = useDiscoveryRuns(sourceId);
  const updateSource = useUpdateSource();
  const deleteSource = useDeleteSource();
  const runDiscovery = useRunDiscovery();
  const testConnection = useTestConnection();
  const createAudit = useCreateAuditEvent();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const connector = source ? getConnector(source.connector_id) : null;
  const backUrl = pathFor(panel.id, area.id, mod.id, 'ai-sources');

  const handleRun = async () => {
    try {
      await runDiscovery.mutateAsync(source.id);
      await createAudit.mutateAsync({ action: 'discovery_started', resource_type: 'discovery_source', resource_id: source.id, result: 'success' });
    } catch { /* toast handles it */ }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({ sourceId: source.id });
      setTestResult(result);
      await updateSource.mutateAsync({ id: source.id, data: { connection_status: result.ok ? 'connected' : result.status } });
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    }
    setTesting(false);
  };

  const handleToggle = async () => {
    const newEnabled = source.enabled === false ? true : false;
    await updateSource.mutateAsync({ id: source.id, data: { enabled: newEnabled, connection_status: newEnabled ? 'connected' : 'disabled' } });
    await createAudit.mutateAsync({ action: newEnabled ? 'source_enabled' : 'source_disabled', resource_type: 'discovery_source', resource_id: source.id, result: 'success' });
  };

  const handleDelete = async () => {
    await deleteSource.mutateAsync(source.id);
    await createAudit.mutateAsync({ action: 'source_deleted', resource_type: 'discovery_source', resource_id: source.id, result: 'success' });
    navigate(backUrl);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <button onClick={() => navigate(backUrl)} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> AI Sources
        </button>
        <div className="py-20 text-center text-sm text-muted-foreground">Source not found.</div>
      </div>
    );
  }

  const Icon = connector?.icon;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Back nav */}
      <button
        onClick={() => navigate(backUrl)}
        className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        id="btn-back-ai-sources"
      >
        <ArrowLeft className="h-4 w-4" /> AI Sources
      </button>

      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-md ring-1 ring-black/10"
          style={{ backgroundColor: connector?.color || '#6b7280' }}
        >
          {Icon && <Icon className="h-7 w-7" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{source.name}</h1>
            <ConnectionStatusBadge status={source.connection_status} />
            {source.enabled === false && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Disabled</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {connector?.name || source.connector_id}
            {source.config?.environment ? ` · ${source.config.environment}` : ''}
            {` · ${formatSchedule(source.scan_frequency)}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last sync: {formatRelative(source.last_successful_scan || source.last_scan_at)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testing}
            className="gap-1.5"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
            Test
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={runDiscovery.isPending || !source.enabled || source.connection_status !== 'connected'}
            className="gap-1.5"
          >
            {runDiscovery.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDanger = tab.id === 'danger';
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? isDanger
                    ? 'bg-red-50 text-red-600 shadow-sm ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-900'
                    : 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : isDanger
                    ? 'text-red-500/70 hover:bg-red-50/50 hover:text-red-600 dark:text-red-500/50 dark:hover:bg-red-950/20'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          source={source}
          connector={connector}
          runs={runs}
          onRun={handleRun}
          onTest={handleTest}
          onToggle={handleToggle}
          running={runDiscovery.isPending}
          testing={testing}
          testResult={testResult}
        />
      )}
      {activeTab === 'configuration' && (
        <ConfigurationTab source={source} connector={connector} />
      )}
      {activeTab === 'discovery' && (
        <DiscoveryTab source={source} runs={runs} />
      )}
      {activeTab === 'logs' && (
        <LogsTab source={source} logs={logs} />
      )}
      {activeTab === 'danger' && (
        <DangerZoneTab
          source={source}
          connector={connector}
          onToggle={handleToggle}
          onDelete={() => setDeleteOpen(true)}
        />
      )}

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{source.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the connection and stops future discovery runs.
              Historical AI assets and evidence collected from this source are preserved for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete Source
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}