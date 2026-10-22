import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, AlertCircle, FileText } from 'lucide-react';
import { RunStatusBadge } from './Badges';
import { useDiscoveryRun, useDiscoveryLogs } from '@/lib/discovery/hooks';
import { formatDuration, formatDateTime } from '@/lib/discovery/helpers';
import { LOG_SEVERITY_META } from '@/lib/discovery/helpers';
import { cn } from '@/lib/utils';

export default function RunDiscoveryDialog({ open, onOpenChange, runId, sourceName, onViewLogs }) {
  const { data: run, isLoading: runLoading } = useDiscoveryRun(runId);
  const { data: logs = [] } = useDiscoveryLogs(runId);

  const isActive = run && ['queued', 'starting', 'connecting', 'fetching', 'analyzing', 'classifying', 'deduplicating', 'enriching', 'saving'].includes(run.status);
  const isCompleted = run?.status === 'completed';
  const isFailed = run?.status === 'failed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isActive && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {isCompleted && <Check className="h-5 w-5 text-emerald-600" />}
            {isFailed && <AlertCircle className="h-5 w-5 text-red-600" />}
            Discovery Run {sourceName ? `— ${sourceName}` : ''}
          </DialogTitle>
          <DialogDescription>
            {isActive && 'Discovery is running. This may take 30-60 seconds depending on the number of repositories.'}
            {isCompleted && 'Discovery completed successfully.'}
            {isFailed && 'Discovery failed. Check the error below.'}
            {!run && 'Starting discovery...'}
          </DialogDescription>
        </DialogHeader>

        {run && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <RunStatusBadge status={run.status} />
              {run.duration_ms > 0 && <span className="text-xs text-muted-foreground">{formatDuration(run.duration_ms)}</span>}
              {run.started_at && <span className="text-xs text-muted-foreground">Started {formatDateTime(run.started_at)}</span>}
            </div>

            {isFailed && run.error_message && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-sm text-red-900 dark:text-red-200">{run.error_message}</p>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ResultStat label="Repos Scanned" value={run.repositories_scanned} />
                <ResultStat label="Signals Detected" value={run.signals_detected} />
                <ResultStat label="Findings" value={run.findings_created} />
                <ResultStat label="Assets Created" value={run.assets_created} accent="text-emerald-600 dark:text-emerald-400" />
                <ResultStat label="Assets Updated" value={run.assets_updated} accent="text-blue-600 dark:text-blue-400" />
                <ResultStat label="Duplicates" value={run.duplicates_detected} />
                <ResultStat label="Duration" value={formatDuration(run.duration_ms)} />
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Logs</h4>
                <span className="text-xs text-muted-foreground">{logs.length} entries</span>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
                {logs.length === 0 && runLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading logs...
                  </div>
                )}
                {logs.length === 0 && !runLoading && (
                  <p className="text-xs text-muted-foreground">No logs yet.</p>
                )}
                {logs.map((log, i) => {
                  const m = LOG_SEVERITY_META[log.severity] || LOG_SEVERITY_META.info;
                  return (
                    <div key={log.id || i} className="flex items-start gap-2 text-xs">
                      <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', m.dot)} />
                      <span className="shrink-0 font-mono text-muted-foreground/60">{log.stage}</span>
                      <span className={cn('flex-1', log.severity === 'error' ? 'text-red-600 dark:text-red-400' : log.severity === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                        {log.message}
                      </span>
                      {log.duration_ms > 0 && <span className="shrink-0 text-muted-foreground/50">{log.duration_ms}ms</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {isCompleted && (
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={onViewLogs}>
                  <FileText className="h-4 w-4" /> View Full Logs
                </Button>
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              </div>
            )}
            {isFailed && (
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultStat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className={cn('text-xl font-bold', accent || 'text-foreground')}>{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}