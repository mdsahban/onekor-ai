import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cpu, Boxes, Settings2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OPENAI_DISCOVERY_CAPABILITIES, ANTHROPIC_DISCOVERY_CAPABILITIES } from '@/lib/discovery/connectors';

const CAPABILITY_ICONS = {
  models: Cpu,
  account: Boxes,
  model_metadata: Settings2,
  model_capabilities: Boxes,
};

export default function StepAiDiscovery({ form, updateForm, connector }) {
  const categories = connector.id === 'openai'
    ? OPENAI_DISCOVERY_CAPABILITIES
    : ANTHROPIC_DISCOVERY_CAPABILITIES;

  const currentCategories = form.discoveryCategories || {};

  const toggleCategory = (catId) => {
    updateForm({ discoveryCategories: { ...currentCategories, [catId]: !currentCategories[catId] } });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Discovery Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure what {connector.name} assets OneKor should discover and catalogue.</p>
      </div>

      <div className="space-y-3">
        <Label>Discovery Categories</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.map((cat) => {
            const Icon = CAPABILITY_ICONS[cat.id] || Cpu;
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
        <p className="text-xs text-muted-foreground">How often OneKor should automatically run discovery on this source.</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex gap-2">
          <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">What OneKor discovers</p>
            <p className="mt-1 text-xs text-muted-foreground">
              OneKor calls the {connector.name} models endpoint to discover all available AI models. Each model is catalogued
              as an AI asset with its metadata (capabilities, lifecycle, ownership). Discovery does not send chat completions or generate any content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}