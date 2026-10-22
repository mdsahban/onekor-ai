import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import {
  useScans, useScanFindings, usePromoteFindingToAsset,
  useDetectionProfiles,
} from '@/lib/discovery/scan-hooks';
import { useDiscoverySources } from '@/lib/discovery/hooks';
import { formatRelative, formatDateTime } from '@/lib/discovery/helpers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  FileSearch, Search, Filter, Download, ArrowUpRight, CheckCircle2,
  AlertCircle, ShieldCheck, Sparkles, Brain, Code, FileCode, Layers,
  ExternalLink, ChevronRight, Eye, Boxes, Crosshair, Loader2, Database,
  TrendingUp, Check, AlertTriangle, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const PROVIDER_COLORS = {
  openai: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  anthropic: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  google: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  huggingface: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  azure: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  aws: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  meta: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  custom: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

const ASSET_TYPE_LABELS = {
  ai_application: 'AI Application',
  ai_model: 'AI Model',
  ai_sdk: 'AI SDK',
  ai_agent: 'AI Agent',
  ai_framework: 'AI Framework',
  api_key: 'API Key',
  prompt: 'Prompt',
  ai_service: 'AI Service',
};

export default function ScanOutputTab({ initialScanId }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: scans = [], isLoading: scansLoading } = useScans();
  const { data: sources = [] } = useDiscoverySources();
  const { data: profiles = [] } = useDetectionProfiles();
  const promoteFinding = usePromoteFindingToAsset();

  // Selected scan state: defaults to initialScanId or latest scan
  const [selectedScanId, setSelectedScanId] = useState(initialScanId || '');

  useEffect(() => {
    if (initialScanId) {
      setSelectedScanId(initialScanId);
    } else if (!selectedScanId && scans.length > 0) {
      // Pick first completed scan, or first scan
      const firstCompleted = scans.find((s) => ['completed', 'partially_completed'].includes(s.status));
      setSelectedScanId(firstCompleted ? firstCompleted.id : scans[0].id);
    }
  }, [initialScanId, scans]);

  const activeScan = useMemo(() => {
    return scans.find((s) => s.id === selectedScanId) || null;
  }, [scans, selectedScanId]);

  // Query findings for this scan
  const { data: findings = [], isLoading: findingsLoading } = useScanFindings({
    scanId: selectedScanId,
    runIds: activeScan?.run_ids || [],
  });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [inspectFinding, setInspectFinding] = useState(null);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (confidenceFilter !== 'all' && f.confidence_level !== confidenceFilter) return false;
      if (providerFilter !== 'all' && f.provider !== providerFilter) return false;
      if (assetTypeFilter !== 'all' && f.asset_type !== assetTypeFilter) return false;
      if (statusFilter === 'in_inventory' && !f.asset_id && f.status !== 'asset_created') return false;
      if (statusFilter === 'candidate' && (f.asset_id || f.status === 'asset_created')) return false;

      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (f.name || '').toLowerCase().includes(q);
        const repoMatch = (f.evidence?.repository || '').toLowerCase().includes(q);
        const fileMatch = (f.evidence?.file || '').toLowerCase().includes(q);
        const provMatch = (f.provider || '').toLowerCase().includes(q);
        if (!nameMatch && !repoMatch && !fileMatch && !provMatch) return false;
      }
      return true;
    });
  }, [findings, confidenceFilter, providerFilter, assetTypeFilter, statusFilter, search]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = findings.length;
    const high = findings.filter((f) => f.confidence_level === 'high' || (f.confidence_score || 0) >= 0.75).length;
    const medium = findings.filter((f) => f.confidence_level === 'medium' || ((f.confidence_score || 0) >= 0.5 && (f.confidence_score || 0) < 0.75)).length;
    const low = findings.filter((f) => f.confidence_level === 'low' || (f.confidence_score || 0) < 0.5).length;
    const inInventory = findings.filter((f) => f.asset_id || f.status === 'asset_created').length;
    const candidates = total - inInventory;
    return { total, high, medium, low, inInventory, candidates };
  }, [findings]);

  // Export functions
  const handleExportCSV = () => {
    const rows = [
      ['Finding Name', 'Provider', 'Asset Type', 'Confidence Level', 'Confidence Score', 'Status', 'Repository', 'Source ID', 'Asset ID'],
    ];
    for (const f of filteredFindings) {
      rows.push([
        `"${(f.name || '').replace(/"/g, '""')}"`,
        f.provider || '',
        f.asset_type || '',
        f.confidence_level || '',
        f.confidence_score || 0,
        f.status || '',
        `"${(f.evidence?.repository || '').replace(/"/g, '""')}"`,
        f.source_id || '',
        f.asset_id || '',
      ]);
    }
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scan-output-${selectedScanId || 'all'}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredFindings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `scan-output-${selectedScanId || 'all'}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePromote = async (finding) => {
    await promoteFinding.mutateAsync(finding);
    if (inspectFinding?.id === finding.id) {
      setInspectFinding((prev) => prev ? { ...prev, status: 'asset_created' } : null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Scan Selector ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm">
        <div className="space-y-1 min-w-0">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileSearch className="h-3.5 w-3.5 text-primary" /> Active Scan Output
          </label>
          <div className="flex items-center gap-3">
            <Select value={selectedScanId} onValueChange={setSelectedScanId}>
              <SelectTrigger className="w-[280px] sm:w-[360px] font-medium h-9">
                <SelectValue placeholder="Select a scan to inspect…" />
              </SelectTrigger>
              <SelectContent>
                {scans.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.template_name || 'Detection Run'} · {s.started_at ? formatRelative(s.started_at) : s.id.slice(0, 8)} ({s.findings_count || 0} findings)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeScan && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
            <Badge variant="outline" className={cn(
              'capitalize px-2 py-0.5',
              activeScan.status === 'completed' ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-600 bg-amber-500/10'
            )}>
              {activeScan.status}
            </Badge>
            <span>·</span>
            <span>Started: <strong className="text-foreground">{activeScan.started_at ? formatDateTime(activeScan.started_at) : 'N/A'}</strong></span>
            <span>·</span>
            <span>Duration: <strong className="text-foreground">{activeScan.duration_ms ? `${(activeScan.duration_ms / 1000).toFixed(1)}s` : 'N/A'}</strong></span>
          </div>
        )}
      </div>

      {/* ─── Metrics Summary Cards ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Findings</span>
            <Crosshair className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{metrics.total}</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/15 dark:bg-emerald-950/10 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">High Conf.</span>
            <ShieldCheck className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{metrics.high}</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-50/15 dark:bg-amber-950/10 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Med Conf.</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{metrics.medium}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Low Conf.</span>
            <Info className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-muted-foreground">{metrics.low}</p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-primary">
            <span className="text-[11px] font-medium uppercase tracking-wider">In Inventory</span>
            <Database className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">{metrics.inInventory}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Candidates</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{metrics.candidates}</p>
        </div>
      </div>

      {/* ─── Search, Filters & Export Row ─── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search findings by name, file, repo, provider…"
              className="pl-9 h-9"
            />
          </div>

          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">High (&gt;75%)</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Asset Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Asset Types</SelectItem>
              {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Inventory State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              <SelectItem value="in_inventory">In AI Inventory</SelectItem>
              <SelectItem value="candidate">Candidate Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/30 p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              className="h-8 text-xs px-2.5"
              onClick={() => setViewMode('table')}
            >
              Table
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              className="h-8 text-xs px-2.5"
              onClick={() => setViewMode('cards')}
            >
              Cards
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs"
            onClick={handleExportCSV}
            disabled={filteredFindings.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs"
            onClick={handleExportJSON}
            disabled={filteredFindings.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> JSON
          </Button>
        </div>
      </div>

      {/* ─── Findings Content ─── */}
      {findingsLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card py-16 text-center">
          <FileSearch className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No detection results found</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            {findings.length === 0
              ? 'This scan did not detect any AI signals matching the configured Detection Profiles.'
              : 'No findings match your current search or filter criteria.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Finding / Asset</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Detection Evidence</th>
                <th className="px-4 py-3 font-medium">Inventory Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredFindings.map((finding) => (
                <FindingTableRow
                  key={finding.id}
                  finding={finding}
                  onInspect={() => setInspectFinding(finding)}
                  onPromote={() => handlePromote(finding)}
                  promotePending={promoteFinding.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onInspect={() => setInspectFinding(finding)}
              onPromote={() => handlePromote(finding)}
              promotePending={promoteFinding.isPending}
            />
          ))}
        </div>
      )}

      {/* ─── Evidence & Context Modal / Drawer ─── */}
      {inspectFinding && (
        <FindingEvidenceDialog
          finding={inspectFinding}
          open={!!inspectFinding}
          onOpenChange={(v) => !v && setInspectFinding(null)}
          onPromote={() => handlePromote(inspectFinding)}
          promotePending={promoteFinding.isPending}
        />
      )}
    </div>
  );
}

// ─── Table Row Component ───────────────────────────────────────────────────
function FindingTableRow({ finding, onInspect, onPromote, promotePending }) {
  const pColor = PROVIDER_COLORS[finding.provider?.toLowerCase()] || PROVIDER_COLORS.custom;
  const isLinked = !!finding.asset_id || finding.status === 'asset_created';
  const score = Math.round((finding.confidence_score || 0) * 100);

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Brain className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{finding.name}</p>
            <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[finding.asset_type] || finding.asset_type || 'AI Asset'}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border capitalize', pColor)}>
          {finding.provider || 'unknown'}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs font-semibold',
              score >= 75 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            )}>
              {score}%
            </span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">
              {finding.confidence_level || 'medium'}
            </Badge>
          </div>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-muted-foreground'
              )}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-xs">
        <div className="truncate font-mono">
          {finding.evidence?.repository || finding.evidence?.file || 'Detection signal'}
        </div>
        {finding.evidence?.signals?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {finding.evidence.signals.slice(0, 2).map((sig, i) => (
              <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                {sig}
              </Badge>
            ))}
            {finding.evidence.signals.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{finding.evidence.signals.length - 2}</span>
            )}
          </div>
        )}
      </td>

      <td className="px-4 py-3.5">
        {isLinked ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Canonical Asset
          </span>
        ) : (
          <Badge variant="outline" className="text-[11px] text-muted-foreground font-normal">
            Candidate
          </Badge>
        )}
      </td>

      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={onInspect}
          >
            <Eye className="h-3.5 w-3.5" /> Evidence
          </Button>

          {!isLinked && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs text-primary hover:text-primary"
              onClick={onPromote}
              disabled={promotePending}
            >
              <Database className="h-3.5 w-3.5" /> Promote
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Card View Component ───────────────────────────────────────────────────
function FindingCard({ finding, onInspect, onPromote, promotePending }) {
  const pColor = PROVIDER_COLORS[finding.provider?.toLowerCase()] || PROVIDER_COLORS.custom;
  const isLinked = !!finding.asset_id || finding.status === 'asset_created';
  const score = Math.round((finding.confidence_score || 0) * 100);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm flex flex-col justify-between hover:border-border transition-all">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Brain className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-foreground text-sm truncate">{finding.name}</h4>
              <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[finding.asset_type] || finding.asset_type}</p>
            </div>
          </div>
          <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium border capitalize', pColor)}>
            {finding.provider || 'unknown'}
          </span>
        </div>

        {/* Evidence context */}
        <div className="mt-3 rounded-lg bg-muted/40 p-2 text-xs font-mono text-muted-foreground truncate">
          {finding.evidence?.repository || finding.evidence?.file || 'Discovered signal'}
        </div>

        {/* Confidence score bar */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confidence Score</span>
            <span className="font-semibold text-foreground">{score}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-muted-foreground'
              )}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        {isLinked ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> In Inventory
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Candidate</span>
        )}

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={onInspect}>
            Evidence
          </Button>
          {!isLinked && (
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-primary" onClick={onPromote} disabled={promotePending}>
              Promote
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Evidence & Context Dialog ─────────────────────────────────────────────
function FindingEvidenceDialog({ finding, open, onOpenChange, onPromote, promotePending }) {
  const isLinked = !!finding.asset_id || finding.status === 'asset_created';
  const score = Math.round((finding.confidence_score || 0) * 100);
  const pColor = PROVIDER_COLORS[finding.provider?.toLowerCase()] || PROVIDER_COLORS.custom;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border capitalize', pColor)}>
              {finding.provider || 'unknown'}
            </span>
            <Badge variant="outline" className="text-xs capitalize">
              {finding.confidence_level || 'medium'} confidence
            </Badge>
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground mt-1">
            {finding.name}
          </DialogTitle>
          <DialogDescription>
            Detailed detection evidence explaining why OneKor identified this candidate AI asset.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div>
              <span className="text-[11px] text-muted-foreground">Asset Type</span>
              <p className="font-medium text-foreground">{ASSET_TYPE_LABELS[finding.asset_type] || finding.asset_type}</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">Confidence Score</span>
              <p className="font-medium text-foreground">{score}%</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">Lifecycle State</span>
              <p className="font-medium text-foreground capitalize">{finding.status || 'classified'}</p>
            </div>
          </div>

          {/* Confidence reasons */}
          {finding.confidence_reasons?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Confidence Breakdown
              </span>
              <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                {finding.confidence_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence Details */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5 text-primary" /> Detection Origin & Evidence
            </span>

            <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2 text-xs">
              {finding.evidence?.repository && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Repository:</span>
                  <span className="font-mono font-medium text-foreground">{finding.evidence.repository}</span>
                </div>
              )}
              {finding.evidence?.file && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">File Path:</span>
                  <span className="font-mono font-medium text-foreground">{finding.evidence.file}</span>
                </div>
              )}
              {finding.evidence?.line && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Line Number:</span>
                  <span className="font-mono font-medium text-foreground">L{finding.evidence.line}</span>
                </div>
              )}
              {finding.evidence?.signals?.length > 0 && (
                <div>
                  <span className="text-muted-foreground block mb-1">Detected Signals:</span>
                  <div className="flex flex-wrap gap-1">
                    {finding.evidence.signals.map((s, i) => (
                      <Badge key={i} variant="secondary" className="font-mono text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Raw Match Details / JSON */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5 text-primary" /> Raw Evidence Payload
            </span>
            <pre className="max-h-44 overflow-y-auto rounded-xl border border-border/60 bg-muted/40 p-3 font-mono text-[11px] text-muted-foreground">
              {JSON.stringify(finding.evidence || {}, null, 2)}
            </pre>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>

          {isLinked ? (
            <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 py-1.5 px-3 gap-1.5">
              <Check className="h-4 w-4" /> Correlated in AI Inventory
            </Badge>
          ) : (
            <Button onClick={onPromote} disabled={promotePending} className="gap-2">
              {promotePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Promote to AI Inventory
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
