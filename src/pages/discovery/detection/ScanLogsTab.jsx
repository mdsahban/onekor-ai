import { useState, useMemo } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { useScanLogs, usePurgeScanLogs, useScans } from '@/lib/discovery/scan-hooks';
import { useDiscoverySources } from '@/lib/discovery/hooks';
import { formatDateTime } from '@/lib/discovery/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Terminal, Search, Trash2, Settings, ChevronRight, ChevronDown, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_META = {
  info: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  warn: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  error: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  debug: { color: 'text-muted-foreground', bg: 'bg-muted' },
  critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/20' },
};

const CATEGORY_LABELS = {
  lifecycle: 'Lifecycle', connection: 'Connection', processing: 'Processing', detection: 'Detection',
  ai_model: 'AI Model', rule: 'Rule', sampling: 'Sampling', dedup: 'Dedup', enrichment: 'Enrichment',
  error: 'Error', warning: 'Warning', retry: 'Retry', rate_limit: 'Rate Limit', timeout: 'Timeout',
  permission: 'Permission', connector: 'Connector',
};

export default function ScanLogsTab({ initialScanId }) {
  const { t } = useLanguage();
  const { data: scans = [] } = useScans();
  const { data: sources = [] } = useDiscoverySources();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [scanFilter, setScanFilter] = useState(initialScanId || 'all');
  const [expanded, setExpanded] = useState({});
  const [purgeOpen, setPurgeOpen] = useState(false);

  const { data: logs = [], isLoading } = useScanLogs({
    scanId: scanFilter !== 'all' ? scanFilter : undefined,
    severity: severityFilter,
    category: categoryFilter,
  });

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) => (l.message || '').toLowerCase().includes(q));
  }, [logs, search]);

  const handleExport = () => {
    const csv = ['Timestamp,Severity,Category,Source,Message'];
    for (const l of filtered) {
      csv.push([l.created_date, l.severity, l.category, l.source_id || '', `"${(l.message || '').replace(/"/g, '""')}"`].join(','));
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `scan-logs-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..." className="pl-9" />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Levels</SelectItem><SelectItem value="info">Info</SelectItem><SelectItem value="warn">Warning</SelectItem><SelectItem value="error">Error</SelectItem><SelectItem value="debug">Debug</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Categories</SelectItem>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={scanFilter} onValueChange={setScanFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Scans</SelectItem>{scans.map((s) => <SelectItem key={s.id} value={s.id}>{s.template_name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
        <Button variant="outline" className="gap-2" onClick={() => setPurgeOpen(true)}><Settings className="h-4 w-4" /> Purge Settings</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card py-12 text-center">
          <Terminal className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No logs found. Run a scan to generate operational logs.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.map((log, i) => <LogRow key={log.id} log={log} expanded={!!expanded[log.id]} onToggle={() => setExpanded((e) => ({ ...e, [log.id]: !e[log.id] }))} />)}
          </div>
          <div className="border-t border-border/70 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">{filtered.length} log entries · Updates automatically</div>
        </div>
      )}

      {purgeOpen && <PurgeDialog open={purgeOpen} onOpenChange={setPurgeOpen} />}
    </div>
  );
}

function LogRow({ log, expanded, onToggle }) {
  const m = SEVERITY_META[log.severity] || SEVERITY_META.info;
  return (
    <div className="border-b border-border/30 last:border-0">
      <button onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-2 text-left hover:bg-muted/20">
        <span className={cn('mt-1 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase', m.bg, m.color)}>{log.severity}</span>
        <Badge variant="outline" className="shrink-0 text-[10px]">{CATEGORY_LABELS[log.category] || log.category}</Badge>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{log.message}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateTime(log.created_date)}</span>
        {log.details && <span className="shrink-0">{expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}</span>}
      </button>
      {expanded && log.details && (
        <div className="bg-muted/20 px-4 pb-3 pt-1">
          <pre className="overflow-x-auto rounded-lg bg-card p-3 text-xs text-muted-foreground">{JSON.stringify(log.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function PurgeDialog({ open, onOpenChange }) {
  const purge = usePurgeScanLogs();
  const [days, setDays] = useState(30);
  const [preview, setPreview] = useState(null);

  const handlePreview = async () => { const res = await purge.mutateAsync({ olderThanDays: days, preview: true }); setPreview(res); };
  const handlePurge = async () => { await purge.mutateAsync({ olderThanDays: days }); onOpenChange(false); setPreview(null); };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPreview(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Log Retention & Purge</DialogTitle>
          <DialogDescription>Configure how long scan logs are retained. Purged logs are permanently deleted. All purge operations are recorded in the audit trail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Retention Period (days)</Label>
            <Input type="number" min="1" value={days} onChange={(e) => { setDays(parseInt(e.target.value)); setPreview(null); }} />
            <p className="text-xs text-muted-foreground">Logs older than {days} days will be purged. Set to 0 to purge all logs.</p>
          </div>
          {preview && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10 p-3">
              <p className="text-sm font-medium text-foreground">Purge Preview</p>
              <p className="text-xs text-muted-foreground">{preview.would_delete} log entries will be deleted.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" onClick={handlePreview} disabled={purge.isPending} className="gap-2">Preview</Button>
          <Button variant="destructive" onClick={handlePurge} disabled={purge.isPending} className="gap-2"><Trash2 className="h-4 w-4" /> Purge Now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}