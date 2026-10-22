import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  KeyRound, Loader2, Check, AlertCircle, Lock, ShieldCheck,
  ExternalLink, Building2, FolderGit2, Cpu, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useValidateCredentials } from '@/lib/discovery/hooks';

export default function StepAiAuth({ form, updateForm, connector }) {
  const validate = useValidateCredentials();
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const isOpenAI = connector.id === 'openai';
  const isAnthropic = connector.id === 'anthropic';

  const handleValidate = async () => {
    setValidating(true);
    setValidationError(null);
    try {
      const payload = {
        connectorId: connector.id,
        action: 'validate_api_key',
        apiKey: form.apiKey,
      };
      if (isOpenAI) {
        payload.organization = form.organization || undefined;
        payload.project = form.project || undefined;
      }
      const result = await validate.mutateAsync(payload);
      if (result.ok) {
        updateForm({
          validatedAccount: result.account,
          validatedModels: result.models || [],
        });
      } else {
        setValidationError(result.error || 'Validation failed');
        updateForm({ validatedAccount: null, validatedModels: [] });
      }
    } catch (err) {
      setValidationError(err.message || 'Validation failed');
      updateForm({ validatedAccount: null, validatedModels: [] });
    }
    setValidating(false);
  };

  const apiKeyUrl = isOpenAI
    ? 'https://platform.openai.com/api-keys'
    : 'https://console.anthropic.com/settings/keys';
  const apiKeyPlaceholder = isOpenAI ? 'sk-... or sk-proj-...' : 'sk-ant-...';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Authentication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your {connector.name} API key. OneKor uses it to discover models and collect metadata — it never generates content or modifies your account.
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="api-key">API Key *</Label>
            <a
              href={apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Get API Key
            </a>
          </div>
          <Input
            id="api-key"
            type="password"
            value={form.apiKey}
            onChange={(e) => {
              updateForm({ apiKey: e.target.value, validatedAccount: null, validatedModels: [] });
              setValidationError(null);
            }}
            placeholder={apiKeyPlaceholder}
            className="font-mono"
          />
          {form.validatedAccount && (
            <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Lock className="h-3 w-3" />
              API key securely stored — never displayed after saving
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {isOpenAI
              ? 'Your OpenAI API key. Find it at platform.openai.com/api-keys. Supports personal (sk-...), project-scoped (sk-proj-...), and organization keys.'
              : 'Your Anthropic API key. Find it at console.anthropic.com/settings/keys. Starts with sk-ant-.'}
          </p>
        </div>

        {/* OpenAI optional org/project */}
        {isOpenAI && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="org-id">Organization ID (optional)</Label>
                <Info className="h-3.5 w-3.5 text-muted-foreground" title="Scope the API key to a specific OpenAI organization. Find it at platform.openai.com/settings/organization." />
              </div>
              <Input
                id="org-id"
                value={form.organization}
                onChange={(e) => {
                  updateForm({ organization: e.target.value, validatedAccount: null });
                  setValidationError(null);
                }}
                placeholder="org-..."
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">For organization-scoped access. Leave empty for personal accounts.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="project-id">Project ID (optional)</Label>
                <Info className="h-3.5 w-3.5 text-muted-foreground" title="Scope the API key to a specific OpenAI project. Find it at platform.openai.com/settings/project." />
              </div>
              <Input
                id="project-id"
                value={form.project}
                onChange={(e) => {
                  updateForm({ project: e.target.value, validatedAccount: null });
                  setValidationError(null);
                }}
                placeholder="proj_..."
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">For project-scoped API keys.</p>
            </div>
          </div>
        )}

        {/* Validate button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleValidate}
            disabled={!form.apiKey || validating || !!form.validatedAccount}
            variant={form.validatedAccount ? 'outline' : 'default'}
            className="gap-2"
          >
            {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : form.validatedAccount ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {validating ? 'Validating...' : form.validatedAccount ? 'Validated' : 'Validate Credentials'}
          </Button>
          {form.validatedAccount && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="h-4 w-4" /> Connected
            </span>
          )}
        </div>

        {validationError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm text-red-900 dark:text-red-200">Validation Failed</p>
              <p className="text-xs text-red-700 dark:text-red-300">{validationError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Account info after validation */}
      {form.validatedAccount && (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-foreground">Account Information</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AccountField icon={Cpu} label="Available Models" value={`${form.validatedAccount.model_count || form.validatedModels?.length || 0} models`} available />

            {isOpenAI && form.validatedAccount.organizations && form.validatedAccount.organizations.length > 0 && (
              <AccountField icon={Building2} label="Organizations" value={form.validatedAccount.organizations.join(', ')} available />
            )}

            {isOpenAI && (
              <>
                <AccountField icon={Building2} label="Organization ID" value={form.validatedAccount.organization_id} />
                <AccountField icon={FolderGit2} label="Project ID" value={form.validatedAccount.project_id} />
                <AccountField icon={KeyRound} label="User Email" value={form.validatedAccount.user_email} />
                <AccountField icon={KeyRound} label="Plan" value={form.validatedAccount.plan} />
              </>
            )}

            {isAnthropic && (
              <>
                <AccountField icon={Building2} label="Organization" value={form.validatedAccount.organization_name} />
                <AccountField icon={KeyRound} label="User Email" value={form.validatedAccount.user_email} />
                <AccountField icon={KeyRound} label="Plan" value={form.validatedAccount.plan} />
              </>
            )}
          </div>

          {(isOpenAI || isAnthropic) && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                <Info className="inline h-3 w-3 mr-1" />
                Some account fields (email, plan, organization name) are not exposed through the {connector.name} public API.
                OneKor shows "Not available through provider API" for these fields rather than inventing data.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccountField({ icon: Icon, label, value, available }) {
  const isNA = !value || value === 'null' || value === null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', isNA ? 'text-muted-foreground/40' : 'text-primary')} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isNA ? (
          <p className="mt-0.5 text-xs italic text-muted-foreground/60">Not available through provider API</p>
        ) : (
          <p className="mt-0.5 text-sm font-medium text-foreground truncate">{value}</p>
        )}
      </div>
    </div>
  );
}