import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const ENVIRONMENTS = [
  { value: 'development', label: 'Development', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
  { value: 'staging', label: 'Staging', color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
  { value: 'production', label: 'Production', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
];

export default function StepAiConnection({ form, updateForm, connectorName }) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      updateForm({ tags: [...form.tags, tag] });
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    updateForm({ tags: form.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Connection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell OneKor about this {connectorName} source. This identifies your AI platform connection.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="src-name">Source Name *</Label>
        <Input
          id="src-name"
          value={form.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          placeholder={`e.g. ${connectorName} Production`}
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">A name to identify this discovery source.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="src-desc">Description</Label>
        <Textarea
          id="src-desc"
          value={form.description}
          onChange={(e) => updateForm({ description: e.target.value })}
          placeholder={`e.g. ${connectorName} API account for AI asset discovery`}
          rows={2}
          className="max-w-md"
        />
      </div>

      <div className="grid max-w-md grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label>Environment</Label>
          <Select value={form.environment} onValueChange={(v) => updateForm({ environment: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENVIRONMENTS.map((env) => (
                <SelectItem key={env.value} value={env.value}>
                  <span className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', env.color.split(' ')[0])} />
                    {env.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2 max-w-md">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="Type a tag and press Enter"
          />
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-w-md">
            {form.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-0.5 rounded-full hover:bg-muted">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex gap-2">
          <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">What this source is</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This source tells OneKor to discover AI assets from your {connectorName} account. OneKor will use the API key
              you provide to list available models and collect metadata — it will not generate content or modify your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}