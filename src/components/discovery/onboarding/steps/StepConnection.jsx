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

export default function StepConnection({ form, updateForm }) {
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
          Tell OneKor where to discover AI assets. This source identifies your GitHub connection.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="src-name">Source Name *</Label>
          <FieldHelp title="Source Name" text="A name to identify this discovery source. Use a descriptive name like 'GitHub Production' or 'GitHub AI Repositories'." />
        </div>
        <Input
          id="src-name"
          value={form.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          placeholder="e.g. GitHub Production"
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">A name to identify this discovery source.</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="src-desc">Description</Label>
          <FieldHelp title="Description" text="Optional. Add a description to help others understand what this source covers." />
        </div>
        <Textarea
          id="src-desc"
          value={form.description}
          onChange={(e) => updateForm({ description: e.target.value })}
          placeholder="e.g. All AI-related repositories in the engineering organization"
          rows={2}
          className="max-w-md"
        />
      </div>

      <div className="grid max-w-md grid-cols-1 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Environment</Label>
            <FieldHelp title="Environment" text="Categorize this connection by environment. This helps filter sources and apply different policies." />
          </div>
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
        <div className="flex items-center gap-1.5">
          <Label>Tags</Label>
          <FieldHelp title="Tags" text="Optional. Add tags to organize and filter sources in AI Sources." />
        </div>
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
              This source tells OneKor where to discover AI assets. OneKor will use the credentials you provide
              to read repository file trees and selected files — it will not modify any repositories or store your credentials in plain text.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldHelp({ title, text }) {
  const [show, setShow] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShow(!show)}
      className="text-muted-foreground hover:text-primary"
    >
      <Info className="h-3.5 w-3.5" />
      {show && (
        <span className="ml-2 text-xs text-muted-foreground">{text}</span>
      )}
    </button>
  );
}