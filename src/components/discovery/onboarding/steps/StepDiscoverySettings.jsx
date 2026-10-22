import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Package, Boxes, Cpu, Cloud, Bot, Plug, FileCog, Link2, Workflow,
  Settings2, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GITHUB_DISCOVERY_CAPABILITIES } from '@/lib/discovery/connectors';

const CAPABILITY_ICONS = {
  ai_sdks: Package, ai_frameworks: Boxes, ai_models: Cpu, ai_apis: Cloud,
  ai_agents: Bot, mcp: Plug, ai_config: FileCog, ai_dependencies: Link2, ai_workflows: Workflow,
};

export default function StepDiscoverySettings({ form, updateForm }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const categories = GITHUB_DISCOVERY_CAPABILITIES;
  const currentCategories = form.discoveryCategories || {};

  const toggleCategory = (catId) => {
    updateForm({ discoveryCategories: { ...currentCategories, [catId]: !currentCategories[catId] } });
  };

  const updateAdvanced = (key, value) => {
    updateForm({ advanced: { ...form.advanced, [key]: value } });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Discovery Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure what types of AI assets OneKor should look for.</p>
      </div>

      <div className="space-y-3">
        <Label>Discovery Categories</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.map((cat) => {
            const Icon = CAPABILITY_ICONS[cat.id] || Package;
            const isEnabled = currentCategories[cat.id] !== undefined ? currentCategories[cat.id] : cat.enabled;
            return (
              <div key={cat.id} className={cn('flex items-start gap-3 rounded-xl border p-3 transition-colors', isEnabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card')}>
                <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <Switch checked={isEnabled} onCheckedChange={() => toggleCategory(cat.id)} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{cat.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50">
          <span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" />Advanced Discovery</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', advancedOpen && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          <div className="space-y-2">
            <Label htmlFor="ignore-types">Ignore File Types</Label>
            <Input id="ignore-types" value={form.advanced?.ignore_types || ''} onChange={(e) => updateAdvanced('ignore_types', e.target.value)} placeholder="*.docx, *.xlsx, *.csv" />
            <p className="text-xs text-muted-foreground">Comma-separated glob patterns to exclude from scanning.</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Extract Archives</p>
              <p className="text-xs text-muted-foreground">Scan inside .zip, .tar.gz archives.</p>
            </div>
            <Switch checked={form.advanced?.extract_archives || false} onCheckedChange={(v) => updateAdvanced('extract_archives', v)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-file-size">Maximum File Size (KB)</Label>
            <Input id="max-file-size" type="number" value={form.advanced?.max_file_size_kb || 1024} onChange={(e) => updateAdvanced('max_file_size_kb', parseInt(e.target.value) || 1024)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scan-exclusions">Scan Exclusions</Label>
            <Input id="scan-exclusions" value={form.advanced?.scan_exclusions || ''} onChange={(e) => updateAdvanced('scan_exclusions', e.target.value)} placeholder="node_modules/, .git/, dist/" />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        <Label>Scan Frequency</Label>
        <Select value={form.scanFrequency} onValueChange={(v) => updateForm({ scanFrequency: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}