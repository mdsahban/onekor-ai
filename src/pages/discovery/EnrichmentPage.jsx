import { useState, useMemo } from 'react';
import { useNav } from '@/components/layout/AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { useAiAssets, useUpdateAiAsset, useDiscoverySources } from '@/lib/discovery/hooks';
import { ASSET_TYPE_LABELS, formatRelative } from '@/lib/discovery/helpers';
import { ConfidenceBadge } from '@/components/discovery/Badges';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Search, Boxes, Save, Pencil, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EnrichmentPage() {
  const { feature } = useNav();
  const { t } = useLanguage();
  const { data: assets = [], isLoading } = useAiAssets();
  const { data: sources = [] } = useDiscoverySources();
  const updateAsset = useUpdateAiAsset();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editAsset, setEditAsset] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({});

  const filtered = useMemo(() => {
    let result = [...assets];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => (a.name || '').toLowerCase().includes(q) || (a.provider || '').toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') result = result.filter((a) => a.asset_type === typeFilter);
    result.sort((a, b) => new Date(b.last_seen || b.created_date) - new Date(a.last_seen || a.created_date));
    return result;
  }, [assets, search, typeFilter]);

  const handleEdit = (asset) => {
    setEditAsset(asset);
    setEditData({
      business_owner: asset.business_owner || '',
      technical_owner: asset.technical_owner || '',
      environment: asset.environment || '',
      tags: (asset.tags || []).join(', '),
      description: asset.description || '',
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    const tags = editData.tags.split(',').map((t) => t.trim()).filter(Boolean);
    await updateAsset.mutateAsync({
      id: editAsset.id,
      data: {
        business_owner: editData.business_owner,
        technical_owner: editData.technical_owner,
        environment: editData.environment,
        tags,
        description: editData.description,
      },
    });
    setEditOpen(false);
  };

  const sourceMap = useMemo(() => {
    const map = {};
    for (const s of sources) map[s.id] = s;
    return map;
  }, [sources]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <feature.icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{t(feature.name)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(feature.desc)}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search AI assets..." className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card py-12 text-center shadow-sm">
          <Boxes className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {assets.length === 0 ? 'No AI assets discovered yet. Run discovery on a source to find AI assets.' : 'No assets match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((asset) => (
            <AssetCard key={asset.id} asset={asset} sourceMap={sourceMap} onEdit={() => handleEdit(asset)} />
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Enrich: {editAsset?.name}
            </DialogTitle>
            <DialogDescription>Add metadata to this AI asset. Enriched data is kept separate from discovered evidence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Business Owner</Label>
              <Input value={editData.business_owner} onChange={(e) => setEditData({ ...editData, business_owner: e.target.value })} placeholder="e.g. Jane Smith" />
            </div>
            <div className="space-y-2">
              <Label>Technical Owner</Label>
              <Input value={editData.technical_owner} onChange={(e) => setEditData({ ...editData, technical_owner: e.target.value })} placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Input value={editData.environment} onChange={(e) => setEditData({ ...editData, environment: e.target.value })} placeholder="e.g. production, staging, development" />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input value={editData.tags} onChange={(e) => setEditData({ ...editData, tags: e.target.value })} placeholder="e.g. critical, customer-facing, approved" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} placeholder="What does this AI asset do?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> Save Enrichment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetCard({ asset, sourceMap, onEdit }) {
  const [showSources, setShowSources] = useState(false);
  const enriched = asset.enriched_data || {};
  const hasEnrichment = asset.business_owner || asset.technical_owner || asset.environment || (asset.tags && asset.tags.length > 0);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold text-foreground">{asset.name}</h3>
          <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type} · {asset.provider}</p>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge level={asset.confidence_score >= 0.75 ? 'high' : asset.confidence_score >= 0.5 ? 'medium' : 'low'} score={asset.confidence_score} />
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Source-Derived Data */}
        <div className="rounded-xl border border-blue-200/50 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/10 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Source-Derived</p>
          <div className="space-y-1 text-xs">
            {enriched.repository ? <DataRow label="Repository" value={enriched.repository} /> : <DataRow label="Repository" value="Not available from source" muted />}
            {enriched.signals ? <DataRow label="Signals" value={enriched.signals.join(', ')} /> : <DataRow label="Signals" value="Not available from source" muted />}
            {enriched.url ? <DataRow label="URL" value={enriched.url} /> : null}
            {enriched.files_scanned != null && <DataRow label="Files Scanned" value={String(enriched.files_scanned)} />}
            <DataRow label="First Seen" value={formatRelative(asset.first_seen)} />
            <DataRow label="Last Seen" value={formatRelative(asset.last_seen)} />
          </div>
        </div>

        {/* Provider-Derived Data */}
        <div className="rounded-xl border border-purple-200/50 bg-purple-50/30 dark:border-purple-900/50 dark:bg-purple-950/10 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Provider-Derived</p>
          <div className="space-y-1 text-xs">
            {enriched.model_id ? <DataRow label="Model ID" value={enriched.model_id} /> : <DataRow label="Model ID" value="Not available from source" muted />}
            {enriched.display_name && <DataRow label="Display Name" value={enriched.display_name} />}
            {enriched.owned_by && <DataRow label="Owned By" value={enriched.owned_by} />}
            {enriched.capabilities && <DataRow label="Capabilities" value={Array.isArray(enriched.capabilities) ? enriched.capabilities.join(', ') : enriched.capabilities} />}
            {enriched.lifecycle && <DataRow label="Lifecycle" value={enriched.lifecycle} />}
            {enriched.max_tokens && <DataRow label="Max Tokens" value={String(enriched.max_tokens)} />}
            {enriched.created && <DataRow label="Created" value={enriched.created} />}
            {!enriched.model_id && !enriched.display_name && <p className="text-xs text-muted-foreground/60">No provider metadata available for this source type.</p>}
          </div>
        </div>

        {/* AI-Derived Analysis */}
        <div className="rounded-xl border border-amber-200/50 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/10 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">AI-Derived Analysis</p>
          <div className="space-y-1 text-xs">
            <DataRow label="Classification" value={ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type} />
            <DataRow label="Confidence" value={`${Math.round((asset.confidence_score || 0) * 100)}%`} />
            <DataRow label="Provider" value={asset.provider || 'unknown'} />
            <DataRow label="Status" value={asset.status || 'unknown'} />
          </div>
        </div>

        {/* User Enrichment */}
        <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/10 p-3">
          <p className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">User Enrichment</span>
            <button onClick={onEdit} className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
              <Pencil className="h-3 w-3" />
            </button>
          </p>
          {hasEnrichment ? (
            <div className="space-y-1 text-xs">
              {asset.business_owner && <DataRow label="Business Owner" value={asset.business_owner} />}
              {asset.technical_owner && <DataRow label="Technical Owner" value={asset.technical_owner} />}
              {asset.environment && <DataRow label="Environment" value={asset.environment} />}
              {asset.tags && asset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {asset.tags.map((tag, i) => (
                    <span key={i} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60">No enrichment yet. Click edit to add.</p>
          )}
        </div>
      </div>

      {enriched.url && (
        <a href={enriched.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> {enriched.url}
        </a>
      )}
    </div>
  );
}

function DataRow({ label, value, muted }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('truncate text-right font-medium', muted ? 'text-muted-foreground/60 italic text-[10px]' : 'text-foreground')}>{value}</span>
    </div>
  );
}