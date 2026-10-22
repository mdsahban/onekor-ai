import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, Loader2, RefreshCw, Check, Folder, GitBranch, Clock, Code2,
  Lock, Globe, CheckCircle2, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useValidateCredentials } from '@/lib/discovery/hooks';

export default function StepScope({ form, updateForm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const validate = useValidateCredentials();

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (form.authMethod === 'github_app') {
        if (!form.installationId) {
          setError('Please select an installation first (go back to Authentication).');
          setLoading(false);
          return;
        }
        result = await validate.mutateAsync({
          connectorId: 'github',
          action: 'get_installation_repos',
          appId: form.appId,
          privateKey: form.privateKey,
          installationId: form.installationId,
        });
      } else {
        result = await validate.mutateAsync({
          connectorId: 'github',
          action: 'get_repos',
          token: form.token,
          organization: form.organization,
        });
      }
      if (result.ok) {
        updateForm({ availableRepos: result.repositories });
      } else {
        setError(result.error || 'Failed to fetch repositories');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch repositories');
    }
    setLoading(false);
  };

  const filteredRepos = useMemo(() => {
    if (!form.availableRepos) return [];
    if (!search) return form.availableRepos;
    const q = search.toLowerCase();
    return form.availableRepos.filter(
      (r) => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)
    );
  }, [form.availableRepos, search]);

  const toggleRepo = (repoName) => {
    const current = form.repositories || [];
    if (current.includes(repoName)) {
      updateForm({ repositories: current.filter((r) => r !== repoName) });
    } else {
      updateForm({ repositories: [...current, repoName] });
    }
  };

  const selectAll = () => {
    updateForm({ repositories: form.availableRepos.map((r) => r.name) });
  };

  const clearAll = () => {
    updateForm({ repositories: [] });
  };

  const hasRepos = form.availableRepos && form.availableRepos.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Scope</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define exactly what GitHub should scan. OneKor will only inspect the repositories you select.
        </p>
      </div>

      {/* Repository mode */}
      <div className="space-y-3">
        <Label>Repository Selection</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => updateForm({ repositoryMode: 'all' })}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
              form.repositoryMode === 'all' ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-primary/30'
            )}
          >
            <div className={cn('grid h-8 w-8 place-items-center rounded-lg', form.repositoryMode === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">All accessible repositories</p>
              <p className="text-xs text-muted-foreground">Scan every repository the credential can access</p>
            </div>
          </button>
          <button
            onClick={() => updateForm({ repositoryMode: 'selected' })}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
              form.repositoryMode === 'selected' ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-primary/30'
            )}
          >
            <div className={cn('grid h-8 w-8 place-items-center rounded-lg', form.repositoryMode === 'selected' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              <Folder className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Selected repositories</p>
              <p className="text-xs text-muted-foreground">Choose specific repositories to scan</p>
            </div>
          </button>
        </div>
      </div>

      {/* Repository browser (only for selected mode) */}
      {form.repositoryMode === 'selected' && (
        <div className="space-y-3">
          {!hasRepos ? (
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
              <Folder className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                {form.authMethod === 'pat' && !form.validatedUser
                  ? 'Validate your credentials first to discover accessible repositories.'
                  : form.authMethod === 'github_app' && !form.installationId
                  ? 'Select an installation first to discover accessible repositories.'
                  : 'Fetch accessible repositories from GitHub to select which ones to scan.'}
              </p>
              <Button onClick={fetchRepos} disabled={loading} className="mt-4 gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loading ? 'Fetching...' : 'Fetch Repositories'}
              </Button>
              {error && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search repositories..."
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll} className="gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear
                </Button>
              </div>

              <div className="rounded-xl border border-border">
                <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                  {form.availableRepos.length} repositories accessible · {form.repositories.length} selected
                </div>
                <div className="max-h-[320px] overflow-y-auto divide-y divide-border/50">
                  {filteredRepos.map((repo) => {
                    const selected = form.repositories.includes(repo.name);
                    return (
                      <label
                        key={repo.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30',
                          selected && 'bg-primary/5'
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleRepo(repo.name)}
                        />
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {repo.private ? (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          ) : (
                            <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{repo.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{repo.full_name}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <Code2 className="h-3 w-3" /> {repo.language}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" /> {repo.default_branch}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatRelativeShort(repo.updated_at)}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                  {filteredRepos.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No repositories match "{search}"
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Branch and path filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="branch-filter">Branch Filter</Label>
            <Info className="h-3.5 w-3.5 text-muted-foreground" title="Limit scanning to a specific branch. Leave empty for default branch." />
          </div>
          <Input
            id="branch-filter"
            value={form.branch}
            onChange={(e) => updateForm({ branch: e.target.value })}
            placeholder="main (default if empty)"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="path-filter">Path Filter</Label>
            <Info className="h-3.5 w-3.5 text-muted-foreground" title="Limit scanning to files whose paths contain this string." />
          </div>
          <Input
            id="path-filter"
            value={form.pathFilter}
            onChange={(e) => updateForm({ pathFilter: e.target.value })}
            placeholder="e.g. src/ (optional)"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Path filter limits scanning to files whose paths contain the given string. Branch filter limits scanning to a specific branch.
      </p>
    </div>
  );

  function fetchAll() {
    fetchRepos();
  }
}

function formatRelativeShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}