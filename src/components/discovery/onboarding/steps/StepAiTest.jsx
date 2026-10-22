import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Check, AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTestConnection } from '@/lib/discovery/hooks';
import DiagnosticCard from '@/components/discovery/DiagnosticCard';

export default function StepAiTest({ form, updateForm, buildConfig, connector }) {
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const testConnection = useTestConnection();

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    updateForm({ testResult: null });
    try {
      const config = buildConfig();
      const apiKey = (form.apiKey || config._api_key || config.apiKey || '').trim();
      const payload = {
        sourceId: form.sourceId || undefined,
        connectorId: connector.id,
        authMethod: 'api_key',
        auth_method: 'api_key',
        apiKey,
        organization: connector.id === 'openai' ? (form.organization || config.organization) : undefined,
        project: connector.id === 'openai' ? (form.project || config.project) : undefined,
        config: {
          ...config,
          auth_method: 'api_key',
          authMethod: 'api_key',
          _api_key: apiKey,
          apiKey,
        },
      };
      const result = await testConnection.mutateAsync(payload);
      updateForm({ testResult: result });
      if (!result.ok) setError(result.error || result.message || 'Connection test failed');
    } catch (err) {
      setError(err.message || 'Connection test failed');
      updateForm({ testResult: { ok: false, error: err.message } });
    }
    setTesting(false);
  };

  const result = form.testResult;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Test Connection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          OneKor will validate your API key and discover available models in real-time. Each stage must pass before the next runs.
        </p>
      </div>

      {!result && !testing && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary/40" />
          <p className="mt-3 text-sm text-muted-foreground">Click "Run Test" to validate your configuration against the real {connector.name} API.</p>
          <Button onClick={handleTest} className="mt-4 gap-2">
            <Play className="h-4 w-4" /> Run Test
          </Button>
        </div>
      )}

      {testing && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Testing connection against {connector.name} API...</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className={cn('rounded-xl border p-4', result.ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30')}>
            <div className="flex gap-2">
              {result.ok ? <Check className="h-5 w-5 shrink-0 text-emerald-600" /> : <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />}
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', result.ok ? 'text-emerald-900 dark:text-emerald-200' : 'text-red-900 dark:text-red-200')}>
                  {result.ok ? 'All Tests Passed' : 'Connection Test Failed'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{result.message || result.error}</p>
                {result.model_count != null && (
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    {result.model_count} model(s) available for discovery.
                  </p>
                )}
              </div>
            </div>
          </div>

          {result.steps && result.steps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Test Stages</h3>
              {result.steps.map((s, i) => {
                const passed = s.status === 'success' || s.status === 'connected';
                return (
                  <div key={i} className={cn('flex items-start gap-3 rounded-lg border p-3', passed ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20' : s.status === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20' : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20')}>
                    <div className="mt-0.5">
                      {passed ? <Check className="h-4 w-4 text-emerald-600" /> : s.status === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{s.stage || `Stage ${i + 1}`}</p>
                        {s.latency_ms != null && s.latency_ms > 0 && <Badge variant="outline" className="text-[10px]">{s.latency_ms}ms</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!result.ok && (
            <DiagnosticCard
              result={result}
              connectorId={connector.id}
              onRetry={handleTest}
            />
          )}

          {!result.ok && (
            <Button onClick={handleTest} disabled={testing} variant="outline" className="gap-2">
              <Play className="h-4 w-4" /> Retry Test
            </Button>
          )}
          {result.ok && (
            <Button onClick={handleTest} disabled={testing} variant="outline" className="gap-2">
              <Play className="h-4 w-4" /> Re-run Test
            </Button>
          )}
        </div>
      )}
    </div>
  );
}