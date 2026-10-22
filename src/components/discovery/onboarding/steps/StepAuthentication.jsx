import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  KeyRound, Github, Loader2, Check, AlertCircle, Upload, Lock,
  ShieldCheck, ExternalLink, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useValidateCredentials } from '@/lib/discovery/hooks';
import { GITHUB_PAT_PERMISSIONS } from '@/lib/discovery/connectors';

export default function StepAuthentication({ form, updateForm }) {
  const validate = useValidateCredentials();
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [showTokenGuide, setShowTokenGuide] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const fileInputRef = useRef(null);

  const handleValidatePAT = async () => {
    setValidating(true);
    setValidationError(null);
    try {
      const result = await validate.mutateAsync({
        connectorId: 'github',
        action: 'validate_pat',
        token: form.token,
      });
      if (result.ok) {
        updateForm({ validatedUser: result.user, validatedInstallations: [] });
      } else {
        setValidationError(result.error || 'Validation failed');
        updateForm({ validatedUser: null });
      }
    } catch (err) {
      setValidationError(err.message || 'Validation failed');
      updateForm({ validatedUser: null });
    }
    setValidating(false);
  };

  const handleValidateApp = async () => {
    setValidating(true);
    setValidationError(null);
    try {
      const result = await validate.mutateAsync({
        connectorId: 'github',
        action: 'validate_app',
        appId: form.appId,
        privateKey: form.privateKey,
      });
      if (result.ok) {
        updateForm({ validatedInstallations: result.installations, validatedUser: null });
        // Auto-select if only one installation
        if (result.installations.length === 1) {
          updateForm({ installationId: result.installations[0].id });
        }
      } else {
        setValidationError(result.error || 'Validation failed');
        updateForm({ validatedInstallations: [] });
      }
    } catch (err) {
      setValidationError(err.message || 'Validation failed');
      updateForm({ validatedInstallations: [] });
    }
    setValidating(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      if (content && content.includes('PRIVATE KEY')) {
        updateForm({ privateKey: content, privateKeyFileName: file.name });
      } else {
        setValidationError('The uploaded file does not appear to be a valid PEM private key.');
      }
    };
    reader.readAsText(file);
  };

  const removePrivateKey = () => {
    updateForm({ privateKey: '', privateKeyFileName: '', installationId: null, validatedInstallations: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const authMethods = [
    { id: 'pat', label: 'Personal Access Token', icon: KeyRound, available: true },
    { id: 'github_app', label: 'GitHub App', icon: Github, available: true },
    { id: 'oauth', label: 'OAuth', icon: KeyRound, available: false, comingSoon: true },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Authentication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how OneKor should authenticate with GitHub. The form changes based on your selection.
        </p>
      </div>

      {/* Auth method selector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {authMethods.map((method) => {
          const Icon = method.icon;
          const selected = form.authMethod === method.id;
          return (
            <button
              key={method.id}
              onClick={() => method.available && updateForm({
                authMethod: method.id,
                validatedUser: null,
                validatedInstallations: [],
                installationId: null,
                validationError: null,
              })}
              disabled={!method.available}
              className={cn(
                'relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-card hover:border-primary/30',
                !method.available && 'cursor-not-allowed opacity-60'
              )}
            >
              <Icon className={cn('h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} />
              <div>
                <p className={cn('text-sm font-medium', selected ? 'text-primary' : 'text-foreground')}>{method.label}</p>
                {method.comingSoon ? (
                  <p className="text-[11px] text-muted-foreground">Coming Soon</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {method.id === 'pat' ? 'Token-based auth' : method.id === 'github_app' ? 'App + private key' : ''}
                  </p>
                )}
              </div>
              {selected && (
                <div className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* PAT form */}
      {form.authMethod === 'pat' && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="gh-username">GitHub Username (optional)</Label>
            <Input
              id="gh-username"
              value={form.organization || ''}
              onChange={(e) => updateForm({ organization: e.target.value })}
              placeholder="e.g. octocat (for user repos, leave empty for your own)"
            />
            <p className="text-xs text-muted-foreground">Enter a GitHub username or organization to scan their repositories. Leave empty to scan your own repositories.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="gh-token">Personal Access Token *</Label>
              <button
                onClick={() => setShowTokenGuide(!showTokenGuide)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Info className="h-3 w-3" />
                Generate Token Guide
              </button>
            </div>
            <Input
              id="gh-token"
              type="password"
              value={form.token}
              onChange={(e) => {
                updateForm({ token: e.target.value, validatedUser: null });
                setValidationError(null);
              }}
              placeholder="ghp_... or github_pat_..."
              className="font-mono"
            />
            {form.validatedUser && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Lock className="h-3 w-3" />
                Token securely stored — never displayed after saving
              </p>
            )}
          </div>

          {/* Token guide */}
          {showTokenGuide && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">How to create a GitHub Personal Access Token</h4>
                <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <li>1. Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">GitHub Settings → Tokens <ExternalLink className="h-3 w-3" /></a></li>
                  <li>2. Click "Generate new token" (classic) or "Fine-grained token"</li>
                  <li>3. Select the required permissions (see below)</li>
                  <li>4. Copy the token and paste it here</li>
                </ol>
              </div>
              <div>
                <button
                  onClick={() => setShowPerms(!showPerms)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {showPerms ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Required & Optional Permissions
                </button>
                {showPerms && (
                  <div className="mt-2 space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Required</p>
                      {GITHUB_PAT_PERMISSIONS.required.map((p) => (
                        <div key={p.scope} className="mt-1 rounded-lg border border-border p-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px]">{p.scope}</Badge>
                            <span className="text-xs font-medium text-foreground">{p.label}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{p.description}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/70"><strong>Why:</strong> {p.why}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Optional</p>
                      {GITHUB_PAT_PERMISSIONS.optional.map((p) => (
                        <div key={p.scope} className="mt-1 rounded-lg border border-border p-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px]">{p.scope}</Badge>
                            <span className="text-xs font-medium text-foreground">{p.label}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{p.description}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/70"><strong>Why:</strong> {p.why}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validate button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleValidatePAT}
              disabled={!form.token || validating || !!form.validatedUser}
              variant={form.validatedUser ? 'outline' : 'default'}
              className="gap-2"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : form.validatedUser ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {validating ? 'Validating...' : form.validatedUser ? 'Validated' : 'Validate Credentials'}
            </Button>
            {form.validatedUser && (
              <div className="flex items-center gap-2">
                {form.validatedUser.avatar_url && (
                  <img src={form.validatedUser.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                )}
                <span className="text-sm text-muted-foreground">
                  Authenticated as <strong className="text-foreground">{form.validatedUser.login}</strong>
                </span>
              </div>
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
      )}

      {/* GitHub App form */}
      {form.authMethod === 'github_app' && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="gh-app-id">GitHub App ID *</Label>
            <Input
              id="gh-app-id"
              value={form.appId}
              onChange={(e) => {
                updateForm({ appId: e.target.value, validatedInstallations: [], installationId: null });
                setValidationError(null);
              }}
              placeholder="e.g. 123456"
            />
            <p className="text-xs text-muted-foreground">Find your App ID in the GitHub App settings page.</p>
          </div>

          <div className="space-y-2">
            <Label>Private Key *</Label>
            {form.privateKey ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Private key securely stored</p>
                    {form.privateKeyFileName && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">{form.privateKeyFileName}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Replace Key
                  </Button>
                  <Button size="sm" variant="outline" onClick={removePrivateKey} className="text-red-600 hover:bg-red-50 dark:text-red-400">
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" /> Upload .pem
                </Button>
                <Input
                  type="password"
                  onChange={(e) => {
                    updateForm({ privateKey: e.target.value, validatedInstallations: [], installationId: null });
                    setValidationError(null);
                  }}
                  placeholder="...or paste private key here"
                  className="font-mono"
                />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pem,.key"
              onChange={handleFileUpload}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Upload the .pem file downloaded when you generated the GitHub App private key, or paste the key directly.
              The key is never displayed after saving.
            </p>
          </div>

          {/* Validate App */}
          {form.privateKey && form.appId && !form.validatedInstallations.length && (
            <Button
              onClick={handleValidateApp}
              disabled={validating}
              className="gap-2"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {validating ? 'Validating App...' : 'Validate GitHub App'}
            </Button>
          )}

          {/* Installation selector */}
          {form.validatedInstallations.length > 0 && (
            <div className="space-y-2">
              <Label>GitHub Organization / Installation *</Label>
              <Select
                value={form.installationId ? String(form.installationId) : ''}
                onValueChange={(v) => updateForm({ installationId: parseInt(v) })}
              >
                <SelectTrigger><SelectValue placeholder="Select an installation..." /></SelectTrigger>
                <SelectContent>
                  {form.validatedInstallations.map((inst) => (
                    <SelectItem key={inst.id} value={String(inst.id)}>
                      <span className="flex items-center gap-2">
                        {inst.account_avatar_url && <img src={inst.account_avatar_url} alt="" className="h-4 w-4 rounded-full" />}
                        {inst.account_login} ({inst.account_type})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.validatedInstallations.length} installation(s) available. Select the organization where your repositories live.
              </p>
            </div>
          )}

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
      )}

      {/* OAuth coming soon */}
      {form.authMethod === 'oauth' && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">OAuth authentication is coming soon.</p>
        </div>
      )}
    </div>
  );
}