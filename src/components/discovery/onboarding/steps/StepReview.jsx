import { KeyRound, Github, Check, Folder, Settings2 } from 'lucide-react';

export default function StepReview({ form, buildConfig }) {
  const config = buildConfig();
  const authLabel = form.authMethod === 'pat' ? 'Personal Access Token' : form.authMethod === 'github_app' ? 'GitHub App' : form.authMethod;
  const AuthIcon = form.authMethod === 'pat' ? KeyRound : Github;

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
        <ReviewSection icon={AuthIcon} title="Authentication">
          <ReviewRow label="Method" value={authLabel} />
          {form.authMethod === 'pat' && form.validatedUser && (
            <ReviewRow label="Authenticated As" value={form.validatedUser.login} />
          )}
          {form.authMethod === 'github_app' && (
            <>
              <ReviewRow label="App ID" value={form.appId} />
              <ReviewRow label="Private Key" value={form.privateKeyFileName || 'Provided'} />
              {form.validatedInstallations.length > 0 && (
                <ReviewRow label="Installation" value={form.validatedInstallations.find((i) => i.id === form.installationId)?.account_login || 'Selected'} />
              )}
            </>
          )}
        </ReviewSection>

        {/* Scope */}
        <ReviewSection icon={Folder} title="Scope">
          <ReviewRow label="Repository Mode" value={form.repositoryMode === 'all' ? 'All accessible' : `${form.repositories.length} selected`} />
          {form.repositoryMode === 'selected' && form.repositories.length > 0 && (
            <ReviewRow label="Repositories" value={form.repositories.join(', ')} />
          )}
          {form.organization && <ReviewRow label="Organization" value={form.organization} />}
          {form.branch && <ReviewRow label="Branch Filter" value={form.branch} />}
          {form.pathFilter && <ReviewRow label="Path Filter" value={form.pathFilter} />}
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