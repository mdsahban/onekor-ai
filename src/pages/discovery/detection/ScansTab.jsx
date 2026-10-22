import { useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { useScans, useScanControl, useRunScan } from '@/lib/discovery/scan-hooks';
import { useScanTemplates } from '@/lib/discovery/scan-hooks';
import { formatRelative } from '@/lib/discovery/helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Activity, Play, Pause, Square, RotateCcw, FileText, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_META = {
  queued: { label: 'Queued', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
  running: { label: 'Running', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-500 animate-pulse' },
  paused: { label: 'Paused', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
  completed: { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
  partially_completed: { label: 'Partial', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
  failed: { label: 'Failed', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
};

export default function ScansTab({ onNavigateLogs }) {
  const { t } = useLanguage();
  const { data: scans = [], isLoading } = useScans();
  const { data: templates = [] } = useScanTemplates();
  const control = useScanControl();
  const runScan = useRunScan();
  const [runOpen, setRunOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleRun = async () => {
    await runScan.mutateAsync({ templateId: selectedTemplate });
    setRunOpen(false); setSelectedTemplate('');
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" /> {scans.length} scan(s) · {scans.filter((s) => ['running', 'queued'].includes(s.status)).length} active
        </div>
        <Button className="gap-2" onClick={() => setRunOpen(true)}><Plus className="h-4 w-4" /> Run Scan</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : scans.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card py-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No scans yet. Create a Scan Template and run it to see results here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/70 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Scan</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Progress</th><th className="px-4 py-3 font-medium">Findings</th>
              <th className="px-4 py-3 font-medium">Duration</th><th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium w-8"></th>
            </tr></thead>
            <tbody>
              {scans.map((scan) => <ScanRow key={scan.id} scan={scan} onNavigateLogs={onNavigateLogs} />)}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Play className="h-4 w-4" /> Run Scan</DialogTitle>
            <DialogDescription>Select a Scan Template to execute. The scan will run in real-time with live progress updates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scan templates available. Create one in the Scan Templates tab first.</p>
            ) : (
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>Cancel</Button>
            <Button onClick={handleRun} disabled={!selectedTemplate || runScan.isPending} className="gap-2">{runScan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScanRow({ scan, onNavigateLogs }) {
  const control = useScanControl();
  const m = STATUS_META[scan.status] || STATUS_META.queued;
  const isActive = ['running', 'queued'].includes(scan.status);
  const isPaused = scan.status === 'paused';
  const isFailed = scan.status === 'failed';

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{scan.template_name}</p>
        <p className="text-xs text-muted-foreground">{scan.source_ids?.length || 0} sources · {scan.profile_ids?.length || 0} profiles</p>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', m.bg, m.color)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} /> {m.label}
        </span>
      </td>
      <td className="px-4 py-3">
        {scan.status === 'running' || scan.status === 'paused' ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${scan.progress || 0}%` }} /></div>
            <span className="text-xs text-muted-foreground">{scan.progress || 0}%</span>
          </div>
        ) : scan.status === 'completed' || scan.status === 'partially_completed' ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">100%</span>
        ) : <span className="text-xs text-muted-foreground">—</span>}
        {scan.current_source && <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{scan.current_source}</p>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{scan.findings_count || 0}</span>
          {(scan.high_confidence_findings > 0) && <Badge variant="outline" className="text-[10px] text-emerald-600">{scan.high_confidence_findings} high</Badge>}
          {(scan.low_confidence_findings > 0) && <Badge variant="outline" className="text-[10px] text-amber-600">{scan.low_confidence_findings} low</Badge>}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{scan.duration_ms ? `${(scan.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{formatRelative(scan.started_at || scan.created_date)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {isActive && <Button size="icon" variant="ghost" className="h-8 w-8" title="Pause" onClick={() => control.mutate({ scanId: scan.id, action: 'pause' })}><Pause className="h-3.5 w-3.5" /></Button>}
          {isPaused && <Button size="icon" variant="ghost" className="h-8 w-8" title="Resume" onClick={() => control.mutate({ scanId: scan.id, action: 'resume' })}><Play className="h-3.5 w-3.5" /></Button>}
          {(isActive || isPaused) && <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" title="Stop" onClick={() => control.mutate({ scanId: scan.id, action: 'stop' })}><Square className="h-3.5 w-3.5" /></Button>}
          {isFailed && <Button size="icon" variant="ghost" className="h-8 w-8" title="Retry" onClick={() => control.mutate({ scanId: scan.id, action: 'retry' })}><RotateCcw className="h-3.5 w-3.5" /></Button>}
          <Button size="icon" variant="ghost" className="h-8 w-8" title="View Logs" onClick={() => onNavigateLogs?.(scan.id)}><FileText className="h-3.5 w-3.5" /></Button>
        </div>
      </td>
    </tr>
  );
}