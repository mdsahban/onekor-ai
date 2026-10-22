import { useState, useMemo } from 'react';
import {
  useScanTemplates, useCreateScanTemplate, useUpdateScanTemplate,
  useDeleteScanTemplate, useRunScan, useDetectionProfiles,
} from '@/lib/discovery/scan-hooks';
import { useDiscoverySources } from '@/lib/discovery/hooks';
import { formatRelative } from '@/lib/discovery/helpers';
import { CONNECTORS } from '@/lib/discovery/connectors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ScanLine, Plus, Search, Play, Copy, Trash2, Pencil, Clock, Loader2,
  Zap, Layers, X, Check, Database, Crosshair, ChevronDown, ChevronUp,
  AlertCircle, Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FREQ_LABELS = { manual: 'Manual', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly' };

// ─── Source picker ────────────────────────────────────────────────────────────
function SourcePicker({ sources, selectedIds, onChange }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sources.filter((s) =>
      !q || s.name.toLowerCase().includes(q) || s.connector_id.toLowerCase().includes(q)
    );
  }, [sources, search]);

  const connectorMeta = (id) => CONNECTORS.find((c) => c.id === id);

  const handleToggle = (sourceId, checked) => {
    const next = new Set(selectedIds);
    checked ? next.add(sourceId) : next.delete(sourceId);
    onChange([...next]);
  };
  const handleSelectAll = () => onChange(filtered.map((s) => s.id));
  const handleClear = () => onChange([]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sources…" className="pl-8 h-8 text-sm" />
        </div>
        <Button type="button" size="sm" variant="ghost" className="text-xs text-muted-foreground h-8" onClick={handleSelectAll}>All</Button>
        <Button type="button" size="sm" variant="ghost" className="text-xs text-muted-foreground h-8" onClick={handleClear}>None</Button>
      </div>
      {sources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          <Plug className="mx-auto h-6 w-6 mb-2 text-muted-foreground/40" />
          No AI Sources configured yet. Add sources in AI Sources first.
        </div>
      ) : (
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/20 p-2">
          {filtered.map((source) => {
            const c = connectorMeta(source.connector_id);
            const isConnected = source.connection_status === 'connected';
            return (
              <label
                key={source.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent',
                  selectedIds.includes(source.id) && 'bg-primary/5 ring-1 ring-primary/20'
                )}
              >
                <Checkbox
                  checked={selectedIds.includes(source.id)}
                  onCheckedChange={(v) => handleToggle(source.id, v)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{source.name}</p>
                  <p className="text-xs text-muted-foreground">{c?.name || source.connector_id}</p>
                </div>
                <span className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  isConnected ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                )} />
              </label>
            );
          })}
          {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No sources match search.</p>}
        </div>
      )}
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">{selectedIds.length} of {sources.length} sources selected</p>
      )}
    </div>
  );
}

// ─── Detection Profile picker ─────────────────────────────────────────────────
function ProfilePicker({ profiles, selectedIds, onChange }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter((p) =>
      p.enabled !== false && (!q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
    );
  }, [profiles, search]);

  const handleToggle = (id, checked) => {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    onChange([...next]);
  };
  const handleSelectAll = () => onChange(filtered.map((p) => p.id));
  const handleClear = () => onChange([]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search detection profiles…" className="pl-8 h-8 text-sm" />
        </div>
        <Button type="button" size="sm" variant="ghost" className="text-xs text-muted-foreground h-8" onClick={handleSelectAll}>All</Button>
        <Button type="button" size="sm" variant="ghost" className="text-xs text-muted-foreground h-8" onClick={handleClear}>None</Button>
      </div>
      {profiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          <Crosshair className="mx-auto h-6 w-6 mb-2 text-muted-foreground/40" />
          No Detection Profiles available. Create profiles in Detection Profiles first.
        </div>
      ) : (
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/20 p-2">
          {filtered.map((profile) => (
            <label
              key={profile.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent',
                selectedIds.includes(profile.id) && 'bg-primary/5 ring-1 ring-primary/20'
              )}
            >
              <Checkbox
                checked={selectedIds.includes(profile.id)}
                onCheckedChange={(v) => handleToggle(profile.id, v)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{profile.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile.category?.replace(/_/g, ' ')}</p>
              </div>
              {profile.is_builtin && <Badge variant="outline" className="text-[10px] shrink-0">Built-in</Badge>}
            </label>
          ))}
          {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No profiles match search.</p>}
        </div>
      )}
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">{selectedIds.length} detection profile{selectedIds.length !== 1 ? 's' : ''} selected</p>
      )}
    </div>
  );
}

// ─── Edit/Create dialog ───────────────────────────────────────────────────────
function ScanProfileDialog({ open, onOpenChange, profile, sources, profiles: detProfiles }) {
  const createTemplate = useCreateScanTemplate();
  const updateTemplate = useUpdateScanTemplate();
  const isEdit = !!profile;

  const [name, setName] = useState(profile?.name || '');
  const [description, setDescription] = useState(profile?.description || '');
  const [sourceIds, setSourceIds] = useState(profile?.source_ids || []);
  const [profileIds, setProfileIds] = useState(profile?.profile_ids || []);
  const [frequency, setFrequency] = useState(profile?.scan_frequency || 'manual');
  const [enabled, setEnabled] = useState(profile?.enabled !== false);
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length >= 2 && sourceIds.length > 0 && profileIds.length > 0;

  const handleSave = async () => {
    setSaving(true);
    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      source_ids: sourceIds,
      profile_ids: profileIds,
      scan_frequency: frequency,
      enabled,
    };
    if (isEdit) {
      await updateTemplate.mutateAsync({ id: profile.id, data });
    } else {
      await createTemplate.mutateAsync(data);
    }
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[90vw] max-w-3xl flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            {isEdit ? `Edit "${profile.name}"` : 'Create Scan Profile'}
          </DialogTitle>
          <DialogDescription>
            A Scan Profile defines which AI Sources to scan and which Detection Profiles to apply during the scan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* General */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">General</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-name">Profile Name *</Label>
                <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Production AI Scan" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-desc">Description</Label>
                <Textarea id="sp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will this scan profile do?" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Schedule</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <Switch checked={enabled} onCheckedChange={setEnabled} id="sp-enabled" />
                  <Label htmlFor="sp-enabled" className="text-sm">Enabled</Label>
                </div>
              </div>
            </div>
          </div>

          {/* AI Sources */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Sources</h3>
              {sourceIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">{sourceIds.length} selected</Badge>
              )}
            </div>
            <SourcePicker sources={sources} selectedIds={sourceIds} onChange={setSourceIds} />
          </div>

          {/* Detection Profiles */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Detection Profiles</h3>
              {profileIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">{profileIds.length} selected</Badge>
              )}
            </div>
            <ProfilePicker profiles={detProfiles} selectedIds={profileIds} onChange={setProfileIds} />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          {!isValid && name.trim().length >= 2 && (
            <p className="mr-auto text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Select at least 1 source and 1 detection profile.
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create Scan Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Scan profile card ────────────────────────────────────────────────────────
function ScanProfileCard({ profile, sourceMap, profileMap, onEdit, onDuplicate, onRun, onDelete }) {
  const updateTemplate = useUpdateScanTemplate();
  const [runningLocal, setRunningLocal] = useState(false);
  const sourceNames = (profile.source_ids || []).map((id) => sourceMap[id]?.name).filter(Boolean);
  const detProfileNames = (profile.profile_ids || []).map((id) => profileMap[id]?.name).filter(Boolean);

  const handleRun = async () => {
    setRunningLocal(true);
    await onRun(profile);
    setRunningLocal(false);
  };

  return (
    <div className={cn(
      'group relative flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md',
      !profile.enabled && 'opacity-60'
    )}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ScanLine className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-foreground text-sm">{profile.name}</h3>
            <p className="text-xs text-muted-foreground">{FREQ_LABELS[profile.scan_frequency] || 'Manual'}</p>
          </div>
        </div>
        <Switch
          checked={profile.enabled !== false}
          onCheckedChange={(v) => updateTemplate.mutate({ id: profile.id, data: { enabled: v } })}
          className="shrink-0"
        />
      </div>

      {profile.description && (
        <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{profile.description}</p>
      )}

      {/* Sources */}
      <div className="mb-2.5 space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">AI Sources ({sourceNames.length})</p>
        {sourceNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sourceNames.slice(0, 3).map((n) => (
              <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
            ))}
            {sourceNames.length > 3 && <Badge variant="outline" className="text-[10px]">+{sourceNames.length - 3} more</Badge>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60">No sources</p>
        )}
      </div>

      {/* Detection Profiles */}
      <div className="mb-4 space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Detection Profiles ({detProfileNames.length})</p>
        {detProfileNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {detProfileNames.slice(0, 3).map((n) => (
              <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>
            ))}
            {detProfileNames.length > 3 && <Badge variant="outline" className="text-[10px] text-primary">+{detProfileNames.length - 3} more</Badge>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60">No detection profiles</p>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-border/50">
        <Button size="sm" className="flex-1 gap-1.5 h-8" onClick={handleRun} disabled={runningLocal || !profile.enabled}>
          {runningLocal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Run Now
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDuplicate} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={onDelete} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>

      {profile.updated_date && (
        <p className="mt-2 text-[10px] text-muted-foreground/60">Updated {formatRelative(profile.updated_date)}</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ScanProfilesTab({ onNavigateHistory }) {
  const { data: templates = [], isLoading } = useScanTemplates();
  const { data: sources = [] } = useDiscoverySources();
  const { data: profiles = [] } = useDetectionProfiles();
  const deleteTemplate = useDeleteScanTemplate();
  const createTemplate = useCreateScanTemplate();
  const runScan = useRunScan();

  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [runningId, setRunningId] = useState(null);

  const sourceMap = useMemo(() => { const m = {}; sources.forEach((s) => (m[s.id] = s)); return m; }, [sources]);
  const profileMap = useMemo(() => { const m = {}; profiles.forEach((p) => (m[p.id] = p)); return m; }, [profiles]);

  const filtered = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter((t) => (t.name || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }, [templates, search]);

  const handleRun = async (profile) => {
    setRunningId(profile.id);
    try {
      const result = await runScan.mutateAsync({ templateId: profile.id });
      onNavigateHistory?.(result?.scan_id || result?.data?.scan_id);
    } catch {}
    setRunningId(null);
  };

  const handleDuplicate = (tpl) => {
    const copy = { ...tpl, name: `${tpl.name} (Copy)` };
    delete copy.id; delete copy.created_date; delete copy.updated_date; delete copy.created_by_id;
    createTemplate.mutate(copy);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteTemplate.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const connectedSources = sources.filter((s) => s.connection_status === 'connected').length;
  const enabledProfiles = profiles.filter((p) => p.enabled !== false).length;

  return (
    <div>
      {/* Info strip */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Scan Profiles', value: templates.length, icon: ScanLine },
          { label: 'Connected Sources', value: connectedSources, icon: Database },
          { label: 'Detection Profiles', value: enabledProfiles, icon: Crosshair },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search scan profiles…" className="pl-9" />
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setEditOpen(true); }}>
          <Plus className="h-4 w-4" /> Create Scan Profile
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card py-16 text-center">
          <ScanLine className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold text-foreground">No Scan Profiles</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Create a Scan Profile to define which AI Sources to scan and which Detection Profiles to apply.
          </p>
          <Button className="mt-4 gap-2" onClick={() => { setEditing(null); setEditOpen(true); }}>
            <Plus className="h-4 w-4" /> Create Scan Profile
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <ScanProfileCard
              key={tpl.id}
              profile={tpl}
              sourceMap={sourceMap}
              profileMap={profileMap}
              onEdit={() => { setEditing(tpl); setEditOpen(true); }}
              onDuplicate={() => handleDuplicate(tpl)}
              onRun={handleRun}
              onDelete={() => setDeleteTarget(tpl)}
            />
          ))}
        </div>
      )}

      {editOpen && (
        <ScanProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={editing}
          sources={sources}
          profiles={profiles}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this Scan Profile. Past scan history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
