import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import {
  useScanTemplates, useCreateScanTemplate, useUpdateScanTemplate,
  useDeleteScanTemplate, useRunScan,
  useDetectionProfiles,
} from '@/lib/discovery/scan-hooks';
import { useDiscoverySources } from '@/lib/discovery/hooks';
import { formatRelative } from '@/lib/discovery/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScanLine, Plus, Search, Play, Copy, Trash2, Pencil, Clock, Loader2, Zap, Gauge, Layers } from 'lucide-react';

export default function ScanTemplatesTab() {
  const { t } = useLanguage();
  const { data: templates = [], isLoading } = useScanTemplates();
  const { data: sources = [] } = useDiscoverySources();
  const { data: profiles = [] } = useDetectionProfiles();
  const deleteTemplate = useDeleteScanTemplate();
  const createTemplate = useCreateScanTemplate();
  const runScan = useRunScan();
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const sourceMap = useMemo(() => { const m = {}; sources.forEach((s) => (m[s.id] = s)); return m; }, [sources]);
  const profileMap = useMemo(() => { const m = {}; profiles.forEach((p) => (m[p.id] = p)); return m; }, [profiles]);

  const filtered = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter((t) => (t.name || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }, [templates, search]);

  const handleRun = async (template) => { await runScan.mutateAsync({ templateId: template.id }); };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9" />
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setEditOpen(true); }}><Plus className="h-4 w-4" /> Create Template</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card py-12 text-center">
          <ScanLine className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No scan templates yet. Create one to define reusable scan configurations.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} sourceMap={sourceMap} profileMap={profileMap}
              onEdit={() => { setEditing(tpl); setEditOpen(true); }}
              onDuplicate={() => { const c = { ...tpl, name: `${tpl.name} (Copy)` }; delete c.id; delete c.created_date; delete c.updated_date; createTemplate.mutate(c); }}
              onRun={() => handleRun(tpl)}
              onDelete={() => { if (confirm(`Delete "${tpl.name}"?`)) deleteTemplate.mutate(tpl.id); }}
            />
          ))}
        </div>
      )}

      {editOpen && <TemplateEditDialog open={editOpen} onOpenChange={setEditOpen} template={editing} sources={sources} profiles={profiles} />}
    </div>
  );
}

function TemplateCard({ template, sourceMap, profileMap, onEdit, onDuplicate, onRun, onDelete }) {
  const updateTemplate = useUpdateScanTemplate();
  const sourceNames = (template.source_ids || []).map((id) => sourceMap[id]?.name).filter(Boolean);
  const profileNames = (template.profile_ids || []).map((id) => profileMap[id]?.name).filter(Boolean);
  const schedule = template.scheduling?.frequency || 'manual';

  return (
    <div className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold text-foreground">{template.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{template.description || 'No description'}</p>
        </div>
        <Switch checked={template.enabled} onCheckedChange={(v) => updateTemplate.mutate({ id: template.id, data: { enabled: v } })} />
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2">
          <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sources</p>
            <p className="truncate text-xs text-foreground">{sourceNames.length > 0 ? sourceNames.join(', ') : 'None selected'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profiles</p>
            <p className="truncate text-xs text-foreground">{profileNames.length > 0 ? `${profileNames.length} profile(s)` : 'None selected'}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {template.incremental_scan && <Badge variant="outline" className="gap-1 text-[10px]"><Zap className="h-3 w-3" /> Incremental</Badge>}
        {template.sampling?.enabled && <Badge variant="outline" className="gap-1 text-[10px]"><Gauge className="h-3 w-3" /> {template.sampling.percentage}% sample</Badge>}
        <Badge variant="outline" className="gap-1 text-[10px]"><Clock className="h-3 w-3" /> {schedule}</Badge>
        {template.last_run_at && <span className="text-[10px] text-muted-foreground">Last run: {formatRelative(template.last_run_at)}</span>}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={onRun} disabled={!template.enabled || !template.source_ids?.length || !template.profile_ids?.length}><Play className="h-3.5 w-3.5" /> Run Now</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="gap-1.5 text-red-600" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function TemplateEditDialog({ open, onOpenChange, template, sources, profiles }) {
  const createTemplate = useCreateScanTemplate();
  const updateTemplate = useUpdateScanTemplate();
  const [data, setData] = useState({});

  useEffect(() => {
    if (template) {
      setData({
        name: template.name || '', description: template.description || '',
        source_ids: template.source_ids || [], profile_ids: template.profile_ids || [],
        confidence_threshold: template.confidence_threshold ?? 0.5, deduplication: template.deduplication ?? true,
        evidence_collection: template.evidence_collection ?? true, enrichment_enabled: template.enrichment_enabled ?? true,
        incremental_scan: template.incremental_scan ?? false, change_detection: template.change_detection ?? false,
        concurrency: template.concurrency ?? 6, batch_size: template.batch_size ?? 6,
        timeout_seconds: template.timeout_seconds ?? 120, enabled: template.enabled ?? true,
        scheduling: template.scheduling || { frequency: 'manual' },
        sampling: template.sampling || { enabled: false, percentage: 100, strategy: 'latest' },
        scan_scope: template.scan_scope || { file_types: [], include_patterns: [], exclude_patterns: [] },
        data_limits: template.data_limits || { max_resources: 0, max_findings: 0, max_duration_seconds: 0 },
        rate_limit: template.rate_limit || { enabled: false, requests_per_minute: 0 },
        retry_policy: template.retry_policy || { max_retries: 2, backoff: 'exponential' },
      });
    } else {
      setData({
        name: '', description: '', source_ids: [], profile_ids: [],
        confidence_threshold: 0.5, deduplication: true, evidence_collection: true,
        enrichment_enabled: true, incremental_scan: false, change_detection: false,
        concurrency: 6, batch_size: 6, timeout_seconds: 120, enabled: true,
        scheduling: { frequency: 'manual' }, sampling: { enabled: false, percentage: 100, strategy: 'latest' },
        scan_scope: { file_types: [], include_patterns: [], exclude_patterns: [] },
        data_limits: { max_resources: 0, max_findings: 0, max_duration_seconds: 0 },
        rate_limit: { enabled: false, requests_per_minute: 0 },
        retry_policy: { max_retries: 2, backoff: 'exponential' },
      });
    }
  }, [template, open]);

  const toggleSource = (id) => setData((d) => ({ ...d, source_ids: d.source_ids.includes(id) ? d.source_ids.filter((x) => x !== id) : [...d.source_ids, id] }));
  const toggleProfile = (id) => setData((d) => ({ ...d, profile_ids: d.profile_ids.includes(id) ? d.profile_ids.filter((x) => x !== id) : [...d.profile_ids, id] }));

  const handleSave = () => {
    if (template) updateTemplate.mutate({ id: template.id, data });
    else createTemplate.mutate(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-4 w-4" /> {template ? 'Edit Scan Template' : 'Create Scan Template'}</DialogTitle>
          <DialogDescription>Define what sources to scan, what profiles to run, and how the scan should execute.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Template Name</Label><Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="e.g. Weekly AI Discovery Scan" /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} rows={2} /></div>

          <div className="space-y-2">
            <Label>AI Sources ({data.source_ids?.length || 0} selected)</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-border/50 p-2">
              {sources.length === 0 ? <p className="text-xs text-muted-foreground p-2">No sources configured. Add sources in AI Sources first.</p> :
                sources.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted/30 cursor-pointer">
                    <input type="checkbox" checked={data.source_ids?.includes(s.id)} onChange={() => toggleSource(s.id)} className="rounded" />
                    <span className="text-sm">{s.name}</span><span className="text-xs text-muted-foreground capitalize">· {s.connector_id}</span>
                  </label>
                ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Detection Profiles ({data.profile_ids?.length || 0} selected)</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-border/50 p-2">
              {profiles.length === 0 ? <p className="text-xs text-muted-foreground p-2">No profiles available. Create profiles in the Detection Profiles tab first.</p> :
                profiles.filter((p) => p.enabled).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted/30 cursor-pointer">
                    <input type="checkbox" checked={data.profile_ids?.includes(p.id)} onChange={() => toggleProfile(p.id)} className="rounded" />
                    <span className="text-sm">{p.name}</span>
                  </label>
                ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Smart Scanning Optimization</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between"><div><span className="text-sm font-medium">Incremental Scan</span><p className="text-xs text-muted-foreground">Only scan resources that changed since last scan</p></div><Switch checked={data.incremental_scan} onCheckedChange={(v) => setData({ ...data, incremental_scan: v })} /></label>
              <label className="flex items-center justify-between"><div><span className="text-sm font-medium">Change Detection</span><p className="text-xs text-muted-foreground">Detect and skip unchanged files</p></div><Switch checked={data.change_detection} onCheckedChange={(v) => setData({ ...data, change_detection: v })} /></label>
              <label className="flex items-center justify-between"><div><span className="text-sm font-medium">Sampling</span><p className="text-xs text-muted-foreground">Scan a subset of resources to reduce workload</p></div><Switch checked={data.sampling?.enabled} onCheckedChange={(v) => setData({ ...data, sampling: { ...data.sampling, enabled: v } })} /></label>
              {data.sampling?.enabled && (
                <div className="ml-4 space-y-2">
                  <Label className="text-xs">Sample Percentage: {data.sampling.percentage}%</Label>
                  <input type="range" min="10" max="100" step="10" value={data.sampling.percentage} onChange={(e) => setData({ ...data, sampling: { ...data.sampling, percentage: parseInt(e.target.value) } })} className="w-full" />
                  <p className="text-xs text-muted-foreground">Sampling {data.sampling.percentage}% of unchanged files can reduce scan workload while preserving changed-resource coverage.</p>
                </div>
              )}
              <label className="flex items-center justify-between"><div><span className="text-sm font-medium">Deduplication</span><p className="text-xs text-muted-foreground">Skip duplicate findings</p></div><Switch checked={data.deduplication} onCheckedChange={(v) => setData({ ...data, deduplication: v })} /></label>
              <label className="flex items-center justify-between"><div><span className="text-sm font-medium">Evidence Collection</span><p className="text-xs text-muted-foreground">Collect detailed evidence for each finding</p></div><Switch checked={data.evidence_collection} onCheckedChange={(v) => setData({ ...data, evidence_collection: v })} /></label>
              <label className="flex items-center justify-between"><div><span className="text-sm font-medium">Enrichment</span><p className="text-xs text-muted-foreground">Enrich findings with additional metadata</p></div><Switch checked={data.enrichment_enabled} onCheckedChange={(v) => setData({ ...data, enrichment_enabled: v })} /></label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Concurrency</Label><Input type="number" value={data.concurrency} onChange={(e) => setData({ ...data, concurrency: parseInt(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Batch Size</Label><Input type="number" value={data.batch_size} onChange={(e) => setData({ ...data, batch_size: parseInt(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Timeout (s)</Label><Input type="number" value={data.timeout_seconds} onChange={(e) => setData({ ...data, timeout_seconds: parseInt(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Confidence Threshold</Label><Input type="number" min="0" max="1" step="0.1" value={data.confidence_threshold} onChange={(e) => setData({ ...data, confidence_threshold: parseFloat(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Scheduling</Label><Select value={data.scheduling?.frequency} onValueChange={(v) => setData({ ...data, scheduling: { ...data.scheduling, frequency: v } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="hourly">Hourly</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={data.enabled} onCheckedChange={(v) => setData({ ...data, enabled: v })} /><Label>Enabled</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!data.name || !data.source_ids?.length || !data.profile_ids?.length}>{template ? 'Save Changes' : 'Create Template'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}