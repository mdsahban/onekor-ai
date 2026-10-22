import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import {
  useDetectionProfiles, useCreateDetectionProfile, useUpdateDetectionProfile,
  useDeleteDetectionProfile, useGenerateDetectionProfile, useSeedBuiltinProfiles,
  useAiModels, useRunScan,
} from '@/lib/discovery/scan-hooks';
import { useDiscoverySources } from '@/lib/discovery/hooks';
import { BUILTIN_PROFILES } from '@/lib/discovery/builtin-profiles';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Crosshair, Plus, Search, Copy, Trash2, Pencil, Sparkles, Play, LayoutGrid, Table as TableIcon, Shield, FlaskConical, BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS = {
  api_key: 'API Key', ai_model: 'AI Model', ai_agent: 'AI Agent', ai_framework: 'AI Framework',
  ai_sdk: 'AI SDK', ai_api_endpoint: 'API Endpoint', mcp: 'MCP', prompt: 'Prompt',
  ai_config: 'AI Config', ai_service: 'AI Service', ai_application: 'AI Application',
  shadow_ai: 'Shadow AI', sensitive_ai: 'Sensitive AI', ai_workflow: 'AI Workflow',
  ai_dependency: 'AI Dependency', custom: 'Custom',
};

const SEVERITY_COLORS = {
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

export default function DetectionProfilesTab() {
  const { t } = useLanguage();
  const { data: profiles = [], isLoading } = useDetectionProfiles();
  const { data: sources = [] } = useDiscoverySources();
  const seedBuiltin = useSeedBuiltinProfiles();
  const createProfile = useCreateDetectionProfile();
  const [view, setView] = useState('card');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testingProfile, setTestingProfile] = useState(null);

  // Auto-seed built-in profiles on first load
  useEffect(() => {
    if (!isLoading && profiles.length === 0 && !seedBuiltin.isPending) {
      seedBuiltin.mutate({ profiles: BUILTIN_PROFILES });
    }
  }, [isLoading, profiles.length]);

  const filtered = useMemo(() => {
    let r = [...profiles];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') r = r.filter((p) => p.category === categoryFilter);
    if (statusFilter === 'enabled') r = r.filter((p) => p.enabled);
    if (statusFilter === 'disabled') r = r.filter((p) => !p.enabled);
    return r;
  }, [profiles, search, categoryFilter, statusFilter]);

  const handleCreate = () => { setEditing(null); setEditOpen(true); };
  const handleEdit = (p) => { setEditing(p); setEditOpen(true); };
  const handleDuplicate = (p) => {
    const copy = { ...p, name: `${p.name} (Copy)`, is_builtin: false, is_protected: false };
    delete copy.id; delete copy.created_date; delete copy.updated_date; delete copy.created_by_id;
    createProfile.mutate(copy);
  };
  const handleTest = (p) => { setTestingProfile(p); setTestOpen(true); };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card p-1">
          <ViewToggle active={view === 'card'} onClick={() => setView('card')} icon={LayoutGrid} />
          <ViewToggle active={view === 'table'} onClick={() => setView('table')} icon={TableIcon} />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search profiles..." className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Button className="gap-2" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Generate with AI</Button>
        <Button variant="outline" className="gap-2" onClick={handleCreate}><Plus className="h-4 w-4" /> Create</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card py-12 text-center">
          <Crosshair className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No detection profiles found. Create one or generate with AI.</p>
        </div>
      ) : view === 'card' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => <ProfileCard key={p.id} profile={p} onEdit={() => handleEdit(p)} onDuplicate={() => handleDuplicate(p)} onTest={() => handleTest(p)} />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/70 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Profile</th><th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Rules</th><th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium w-8"></th>
            </tr></thead>
            <tbody>
              {filtered.map((p) => <ProfileRow key={p.id} profile={p} onEdit={() => handleEdit(p)} onDuplicate={() => handleDuplicate(p)} onTest={() => handleTest(p)} />)}
            </tbody>
          </table>
        </div>
      )}

      {editOpen && <ProfileEditDialog open={editOpen} onOpenChange={setEditOpen} profile={editing} />}
      {aiOpen && <AiGenerateDialog open={aiOpen} onOpenChange={setAiOpen} />}
      {testOpen && testingProfile && <TestDialog open={testOpen} onOpenChange={setTestOpen} profile={testingProfile} sources={sources} />}
    </div>
  );
}

function ViewToggle({ active, onClick, icon: Icon }) {
  return <button onClick={onClick} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}><Icon className="h-3.5 w-3.5" /></button>;
}

function ProfileCard({ profile, onEdit, onDuplicate, onTest }) {
  const updateProfile = useUpdateDetectionProfile();
  const deleteProfile = useDeleteDetectionProfile();
  const ruleCount = (profile.detection_rules || []).length;
  return (
    <div className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-foreground">{profile.name}</h3>
            {profile.is_builtin && <Badge variant="secondary" className="gap-1 text-[10px]"><BookOpen className="h-3 w-3" /> Built-in</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{profile.description}</p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium', SEVERITY_COLORS[profile.severity] || SEVERITY_COLORS.medium)}>{profile.severity}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1"><Crosshair className="h-3 w-3" /> {CATEGORY_LABELS[profile.category] || profile.category}</Badge>
        <Badge variant="outline">{ruleCount} rules</Badge>
        <Badge variant="outline">≥{Math.round((profile.confidence_threshold || 0.5) * 100)}%</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={profile.enabled} onCheckedChange={(v) => updateProfile.mutate({ id: profile.id, data: { enabled: v } })} />
          <span className="text-xs text-muted-foreground">{profile.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onTest}><FlaskConical className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
          {!profile.is_protected && <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => { if (confirm(`Delete "${profile.name}"?`)) deleteProfile.mutate(profile.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ profile, onEdit, onDuplicate, onTest }) {
  const updateProfile = useUpdateDetectionProfile();
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {profile.is_builtin && <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="font-medium text-foreground">{profile.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{CATEGORY_LABELS[profile.category] || profile.category}</td>
      <td className="px-4 py-3 text-muted-foreground">{(profile.detection_rules || []).length}</td>
      <td className="px-4 py-3"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', SEVERITY_COLORS[profile.severity] || SEVERITY_COLORS.medium)}>{profile.severity}</span></td>
      <td className="px-4 py-3"><Switch checked={profile.enabled} onCheckedChange={(v) => updateProfile.mutate({ id: profile.id, data: { enabled: v } })} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onTest}><FlaskConical className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
        </div>
      </td>
    </tr>
  );
}

function ProfileEditDialog({ open, onOpenChange, profile }) {
  const createProfile = useCreateDetectionProfile();
  const updateProfile = useUpdateDetectionProfile();
  const { data: aiModels = [] } = useAiModels();
  const validatedModels = aiModels.filter((m) => m.is_validated && m.enabled);
  const [data, setData] = useState({});
  const [rules, setRules] = useState([]);

  useEffect(() => {
    if (profile) {
      setData({
        name: profile.name || '', description: profile.description || '', detection_objective: profile.detection_objective || '',
        detection_instructions: profile.detection_instructions || '', category: profile.category || 'custom',
        detection_methods: profile.detection_methods || [], confidence_threshold: profile.confidence_threshold ?? 0.5,
        severity: profile.severity || 'medium', enabled: profile.enabled ?? true, ai_prompt: profile.ai_prompt || '',
        ai_model_id: profile.ai_model_id || '', asset_type: profile.asset_type || 'ai_application', provider: profile.provider || 'unknown',
      });
      setRules(profile.detection_rules || []);
    } else {
      setData({ name: '', description: '', detection_objective: '', detection_instructions: '', category: 'custom', detection_methods: [], confidence_threshold: 0.5, severity: 'medium', enabled: true, ai_prompt: '', ai_model_id: '', asset_type: 'ai_application', provider: 'unknown' });
      setRules([]);
    }
  }, [profile, open]);

  const handleSave = () => {
    const payload = { ...data, detection_rules: rules, is_builtin: false, is_protected: false, version: '1.0.0' };
    if (profile) updateProfile.mutate({ id: profile.id, data: payload });
    else createProfile.mutate(payload);
    onOpenChange(false);
  };

  const toggleMethod = (m) => {
    setData((d) => ({ ...d, detection_methods: (d.detection_methods || []).includes(m) ? (d.detection_methods || []).filter((x) => x !== m) : [...(d.detection_methods || []), m] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crosshair className="h-4 w-4" /> {profile ? 'Edit Detection Profile' : 'Create Detection Profile'}</DialogTitle>
          <DialogDescription>Define what to detect, how to detect it, and the confidence threshold for findings.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="e.g. OpenAI SDK Detection" /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} placeholder="What does this profile detect?" rows={2} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Category</Label><Select value={data.category} onValueChange={(v) => setData({ ...data, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Severity</Label><Select value={data.severity} onValueChange={(v) => setData({ ...data, severity: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Detection Objective</Label><Input value={data.detection_objective} onChange={(e) => setData({ ...data, detection_objective: e.target.value })} placeholder="What specifically to look for" /></div>
          <div className="space-y-2"><Label>Detection Instructions (English)</Label><Textarea value={data.detection_instructions} onChange={(e) => setData({ ...data, detection_instructions: e.target.value })} placeholder="Instructions for the AI detection engine" rows={2} /></div>
          <div className="space-y-2">
            <Label>Detection Methods</Label>
            <div className="flex flex-wrap gap-2">
              {['package', 'import', 'config', 'file_path', 'api_endpoint', 'model_identifier', 'framework', 'ai_analysis', 'metadata_analysis', 'dependency_analysis'].map((m) => (
                <button key={m} onClick={() => toggleMethod(m)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', (data.detection_methods || []).includes(m) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>{m}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Confidence Threshold</Label><Input type="number" min="0" max="1" step="0.1" value={data.confidence_threshold} onChange={(e) => setData({ ...data, confidence_threshold: parseFloat(e.target.value) })} /></div>
            <div className="space-y-2"><Label>AI Model (optional)</Label><Select value={data.ai_model_id} onValueChange={(v) => setData({ ...data, ai_model_id: v })}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value={null}>None</SelectItem>{validatedModels.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name || m.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Default Asset Type</Label><Input value={data.asset_type} onChange={(e) => setData({ ...data, asset_type: e.target.value })} /></div>
            <div className="space-y-2"><Label>Default Provider</Label><Input value={data.provider} onChange={(e) => setData({ ...data, provider: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>AI Prompt (optional)</Label><Textarea value={data.ai_prompt} onChange={(e) => setData({ ...data, ai_prompt: e.target.value })} placeholder="AI prompt for analyzing ambiguous signals" rows={2} /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Detection Rules ({rules.length})</Label>
              <Button size="sm" variant="outline" onClick={() => setRules([...rules, { pattern: '', type: 'package', asset_type: data.asset_type, provider: data.provider, confidence: 'medium', label: '' }])}><Plus className="h-3 w-3" /> Add Rule</Button>
            </div>
            <div className="space-y-2">
              {rules.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
                  <Input value={r.pattern} onChange={(e) => { const n = [...rules]; n[i] = { ...r, pattern: e.target.value }; setRules(n); }} placeholder="Pattern" className="flex-1" />
                  <Select value={r.type} onValueChange={(v) => { const n = [...rules]; n[i] = { ...r, type: v }; setRules(n); }}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="package">package</SelectItem><SelectItem value="import">import</SelectItem><SelectItem value="config">config</SelectItem><SelectItem value="file_path">file_path</SelectItem><SelectItem value="api_endpoint">api_endpoint</SelectItem><SelectItem value="model_identifier">model_identifier</SelectItem><SelectItem value="framework">framework</SelectItem></SelectContent></Select>
                  <Select value={r.confidence} onValueChange={(v) => { const n = [...rules]; n[i] = { ...r, confidence: v }; setRules(n); }}><SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">high</SelectItem><SelectItem value="medium">medium</SelectItem><SelectItem value="low">low</SelectItem></SelectContent></Select>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setRules(rules.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={data.enabled} onCheckedChange={(v) => setData({ ...data, enabled: v })} /><Label>Enabled</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!data.name}>{profile ? 'Save Changes' : 'Create Profile'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiGenerateDialog({ open, onOpenChange }) {
  const generate = useGenerateDetectionProfile();
  const createProfile = useCreateDetectionProfile();
  const [description, setDescription] = useState('');
  const [generated, setGenerated] = useState(null);

  const handleGenerate = async () => {
    const res = await generate.mutateAsync(description);
    setGenerated(res.profile);
  };

  const handleSave = () => {
    createProfile.mutate({ ...generated, is_builtin: false, is_protected: false, enabled: true, version: '1.0.0' });
    onOpenChange(false); setDescription(''); setGenerated(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setDescription(''); setGenerated(null); } }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI-Assisted Detection Profile</DialogTitle>
          <DialogDescription>Describe what you want to detect in plain English. The AI Engine will generate a structured detection configuration. You can review and edit it before saving.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Detection Requirement</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Find references to AI services, model APIs, agents, SDKs and credentials in source repositories. Identify the provider, technology, location and supporting evidence." rows={4} />
          </div>
          {!generated && <Button onClick={handleGenerate} disabled={!description || generate.isPending} className="gap-2 w-full">{generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate Configuration</Button>}
          {generated && (
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Shield className="h-4 w-4 text-emerald-500" /> Generated Configuration — Review Before Saving</div>
              <div className="space-y-2">
                <div><Label className="text-xs">Name</Label><Input value={generated.name} onChange={(e) => setGenerated({ ...generated, name: e.target.value })} /></div>
                <div><Label className="text-xs">Description</Label><Textarea value={generated.description} onChange={(e) => setGenerated({ ...generated, description: e.target.value })} rows={2} /></div>
                <div><Label className="text-xs">Detection Objective</Label><Input value={generated.detection_objective} onChange={(e) => setGenerated({ ...generated, detection_objective: e.target.value })} /></div>
                <div><Label className="text-xs">Category</Label><Input value={generated.category} onChange={(e) => setGenerated({ ...generated, category: e.target.value })} /></div>
                <div><Label className="text-xs">AI Prompt</Label><Textarea value={generated.ai_prompt} onChange={(e) => setGenerated({ ...generated, ai_prompt: e.target.value })} rows={2} /></div>
                <div>
                  <Label className="text-xs">Detection Rules ({(generated.detection_rules || []).length})</Label>
                  <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                    {(generated.detection_rules || []).map((r, i) => (
                      <div key={i} className="rounded-lg border border-border/50 bg-card p-2 text-xs">
                        <span className="font-medium">{r.label || r.pattern}</span> <span className="text-muted-foreground">· {r.type} · {r.provider} · {r.confidence}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {generated && <Button onClick={handleSave} className="gap-2"><Shield className="h-4 w-4" /> Save & Publish</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestDialog({ open, onOpenChange, profile, sources }) {
  const runScan = useRunScan();
  const [sourceId, setSourceId] = useState('');
  const [result, setResult] = useState(null);
  const githubSources = sources.filter((s) => s.connector_id === 'github');

  const handleTest = async () => {
    const res = await runScan.mutateAsync({ profileId: profile.id, sourceId });
    setResult(res);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setResult(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Test: {profile.name}</DialogTitle>
          <DialogDescription>Run this detection profile against a real source to test its rules.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Source</Label>
            <Select value={sourceId} onValueChange={setSourceId}><SelectTrigger><SelectValue placeholder="Choose a source" /></SelectTrigger><SelectContent>
              {githubSources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent></Select>
          </div>
          {result && (
            <div className={cn('rounded-xl border p-4', result.status === 'completed' ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10' : 'border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10')}>
              <p className="text-sm font-medium text-foreground">Test {result.status}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Findings:</span> {result.findings_count}</div>
                <div><span className="text-muted-foreground">High Confidence:</span> {result.high_confidence_findings}</div>
                <div><span className="text-muted-foreground">Resources:</span> {result.resources_processed}</div>
                <div><span className="text-muted-foreground">Errors:</span> {result.errors_count}</div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleTest} disabled={!sourceId || runScan.isPending} className="gap-2">{runScan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Test Detection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}