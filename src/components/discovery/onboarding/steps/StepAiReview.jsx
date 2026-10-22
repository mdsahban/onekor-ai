import { KeyRound, Check, Settings2 } from 'lucide-react';

export default function StepAiReview({ form, buildConfig, connector }) {
  const config = buildConfig();
  const enabledCategories = Object.entries(form.discoveryCategories || {}).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Review</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review your configuration before connecting.</p>
      </div>

      <div className="space-y-4">
        {/* Connection */}
        <ReviewSection icon={Check} title="Connection">
          <ReviewRow label="Source Name" value={form.name} />
          <ReviewRow label="Environment" value={form.environment} />
          {form.description && <ReviewRow label="Description" value={form.description} />}
          {form.tags.length > 0 && <ReviewRow label="Tags" value={form.tags.join(', ')} />}
        </ReviewSection>

        {/* Authentication */}
        <ReviewSection icon={KeyRound} title="Authentication">
          <ReviewRow label="Method" value="API Key" />
          <ReviewRow label="Provider" value={connector.name} />
          {form.validatedAccount && (
            <ReviewRow label="Models Available" value={`${form.validatedAccount.model_count || form.validatedModels?.length || 0}`} />
          )}
          {connector.id === 'openai' && form.organization && (
            <ReviewRow label="Organization ID" value={form.organization} />
          )}
          {connector.id === 'openai' && form.project && (
            <ReviewRow label="Project ID" value={form.project} />
          )}
        </ReviewSection>

        {/* Discovery */}
        <ReviewSection icon={Settings2} title="Discovery">
          <ReviewRow label="Categories" value={enabledCategories.length > 0 ? `${enabledCategories.length} enabled` : 'All (default)'} />
          <ReviewRow label="Scan Frequency" value={form.scanFrequency} />
        </ReviewSection>

        {/* Test result */}
        {form.testResult?.ok && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex gap-2">
              <Check className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Connection Tested Successfully</p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">All test stages passed. Ready to connect.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || '—'}</span>
    </div>
  );
}