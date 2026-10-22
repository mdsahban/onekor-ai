import { useState } from 'react';
import { useDiscoveryLogs } from '@/lib/discovery/hooks';
import { RunStatusBadge, LogSeverityBadge } from '@/components/discovery/Badges';
import { formatDuration, formatRelative } from '@/lib/discovery/helpers';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';

export default function RunHistoryTable({ runs }) {
  const [expandedRun, setExpandedRun] = useState(null);

  if (!runs || runs.length === 0) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card py-12 text-center shadow-sm">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">No detection runs yet. Run detection on a source to see results here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 font-medium w-8"></th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Signals</th>
            <th className="px-4 py-3 font-medium text-right">New</th>
            <th className="px-4 py-3 font-medium text-right">Updated</th>
            <th className="px-4 py-3 font-medium text-right">Duplicates</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const expanded = expandedRun === run.id;
            return (
              <RunRow key={run.id} run={run} expanded={expanded} onToggle={() => setExpandedRun(expanded ? null : run.id)} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RunRow({ run, expanded, onToggle }) {
  const { data: logs = [], isLoading } = useDiscoveryLogs(expanded ? run.id : null);

  return (
    <>
      <tr className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/20" onClick={onToggle}>
        <td className="px-4 py-3 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-foreground">{run.source_name || run.connector_id}</p>
          <p className="text-xs text-muted-foreground capitalize">{run.connector_id}</p>
        </td>
        <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
        <td className="px-4 py-3 text-right text-muted-foreground">{run.signals_detected ?? '—'}</td>
        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{run.assets_created || 0}</td>
        <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">{run.assets_updated || 0}</td>
        <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">{run.duplicates_detected || 0}</td>
        <td className="px-4 py-3 text-muted-foreground">{formatDuration(run.duration_ms)}</td>
        <td className="px-4 py-3 text-muted-foreground">{formatRelative(run.started_at)}</td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={9} className="px-4 py-3">
            {run.error_message && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{run.error_message}</p>
              </div>
            )}
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading logs...</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logs available.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-border/50 bg-background p-3">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-xs">
                    <LogSeverityBadge severity={log.severity} />
                    <span className="shrink-0 text-muted-foreground">{log.stage}:</span>
                    <span className="text-foreground">{log.message}</span>
                    {log.duration_ms != null && <span className="ml-auto shrink-0 text-muted-foreground">{log.duration_ms}ms</span>}
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}