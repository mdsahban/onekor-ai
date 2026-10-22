import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, Radar, AlertCircle } from 'lucide-react';
import { useRunDiscovery, useAllDiscoveryRuns } from '@/lib/discovery/hooks';
import { RunStatusBadge } from '@/components/discovery/Badges';
import { formatRelative } from '@/lib/discovery/helpers';

export default function RunDetectionPanel({ sources }) {
  const [selectedSource, setSelectedSource] = useState('');
  const [error, setError] = useState(null);
  const runDiscovery = useRunDiscovery();
  const { data: allRuns = [] } = useAllDiscoveryRuns();

  const connectedSources = sources.filter(
    (s) => s.connection_status === 'connected' && s.enabled !== false
  );

  const activeRuns = allRuns.filter((r) =>
    ['queued', 'starting', 'connecting', 'fetching', 'analyzing', 'classifying', 'deduplicating', 'enriching', 'saving'].includes(r.status)
  );

  const handleRun = async () => {
    if (!selectedSource) {
      setError('Select a source to run detection.');
      return;
    }
    setError(null);
    try {
      await runDiscovery.mutateAsync(selectedSource);
    } catch (err) {
      setError(err.message || 'Failed to start detection run.');
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Radar className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">Run Detection</h2>
      </div>

      {connectedSources.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
          <p className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No connected sources. Connect and onboard a source in AI Sources before running detection.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px] space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Select Source</label>
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger><SelectValue placeholder="Choose a connected source..." /></SelectTrigger>
              <SelectContent>
                {connectedSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.connector_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleRun} disabled={runDiscovery.isPending} className="gap-2">
            {runDiscovery.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Detection
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {activeRuns.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Runs</p>
          {activeRuns.map((run) => (
            <div key={run.id} className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20 p-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">{run.source_name || run.connector_id}</p>
                  <p className="text-xs text-muted-foreground">Started {formatRelative(run.started_at)}</p>
                </div>
              </div>
              <RunStatusBadge status={run.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}