import { Button } from '@/components/ui/button';
import { Loader2, Plug, Check } from 'lucide-react';

export default function StepAiConnect({ form, onConnect, connector, saving }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Connect</h2>
        <p className="mt-1 text-sm text-muted-foreground">OneKor is ready to create this source.</p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900">
          <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="mt-3 text-sm font-medium text-emerald-900 dark:text-emerald-200">Ready to Connect</p>
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
          Click Connect to finalize this source. Your API key is stored securely and never displayed again.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Source Name</span><span className="font-medium text-foreground">{form.name}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="font-medium text-foreground">{connector.name}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Auth Method</span><span className="font-medium text-foreground">API Key</span></div>
        {form.validatedAccount && (
          <div className="flex justify-between"><span className="text-muted-foreground">Models Available</span><span className="font-medium text-foreground">{form.validatedAccount.model_count || form.validatedModels?.length || 0}</span></div>
        )}
        <div className="flex justify-between"><span className="text-muted-foreground">Scan Frequency</span><span className="font-medium text-foreground capitalize">{form.scanFrequency}</span></div>
      </div>

      <Button onClick={onConnect} disabled={saving} className="w-full gap-2" size="lg">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
        {saving ? 'Connecting...' : 'Connect Source'}
      </Button>
    </div>
  );
}