import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Check, AlertTriangle, Info, Sparkles, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OPENAI_CONNECTION_GUIDE, ANTHROPIC_CONNECTION_GUIDE } from '@/lib/discovery/connectors';

const STEP_CONTEXT = {
  connection: {
    title: 'Connection',
    guidance: 'Start by giving this source a name that identifies what it represents — for example, "OpenAI Production" or "Claude API Account". The environment field helps you categorize this connection.',
    tips: [
      'Use a descriptive name like "OpenAI Production" or "Anthropic API"',
      'Set the environment to match where this API key is used',
      'Tags help you filter and organize sources in AI Sources',
    ],
  },
  authentication: {
    title: 'Authentication',
    guidance: 'Enter your API key to authenticate with the AI platform. OneKor validates the key by calling the models endpoint — it never sends chat completions or generates content. Your key is stored securely and never displayed after saving.',
    tips: [
      'API keys are the only authentication method supported by the provider API',
      'OneKor validates the key in real-time against the live API',
      'Your API key is never logged or displayed after saving',
    ],
  },
  discovery: {
    title: 'Discovery Settings',
    guidance: 'Configure what types of AI assets OneKor should discover. By default, all model discovery categories are enabled. OneKor catalogues each model as an AI asset in your inventory.',
    tips: [
      'Model discovery is always recommended — it catalogues all available models',
      'Metadata collection enriches each asset with capabilities and lifecycle info',
      'Scan frequency controls how often OneKor refreshes the model catalogue',
    ],
  },
  test: {
    title: 'Test Connection',
    guidance: 'OneKor will validate your API key and discover available models in real-time. Each stage must pass before the next runs. Do not proceed until all critical stages are successful.',
    tips: [
      'All stages run against the real provider API — no simulation',
      'The test discovers models but does not save them until you connect',
      'If a stage fails, the error message explains exactly what went wrong',
    ],
  },
  review: {
    title: 'Review',
    guidance: 'Review your configuration before saving. You can save as a draft (no connection required) or connect immediately if the test passed. Drafts appear in AI Sources but do not run discovery until connected.',
    tips: [
      'Save as Draft if you want to configure but not connect yet',
      'Connect only works after a successful test',
      'You can edit any setting after saving',
    ],
  },
  connect: {
    title: 'Connect',
    guidance: 'OneKor is ready to create this source. Click Connect to finalize. The source will appear immediately in AI Sources with a Connected status, and you can run discovery to catalogue models.',
    tips: [
      'Your API key is stored securely — never displayed again',
      'Discovery can be run manually or on a schedule after connecting',
      'You can disable, edit, or delete the source at any time',
    ],
  },
};

export default function AiPlatformAssistant({ step, form, connector, canProceed }) {
  const ctx = STEP_CONTEXT[step] || STEP_CONTEXT.connection;
  const [showGuide, setShowGuide] = useState(false);

  const guide = connector.id === 'openai' ? OPENAI_CONNECTION_GUIDE : ANTHROPIC_CONNECTION_GUIDE;

  const configChecks = [
    { label: 'Source name configured', ok: form.name.trim().length >= 2 },
    { label: 'API key provided', ok: !!form.apiKey?.trim() },
    { label: 'Credentials validated', ok: !!form.validatedAccount },
    { label: 'Discovery settings configured', ok: true },
    { label: 'Connection tested', ok: !!form.testResult?.ok },
  ];

  const missingItems = configChecks.filter((c) => !c.ok);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Engine</h3>
            <p className="text-[11px] text-muted-foreground">{connector.name} Assistant</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Context-aware guidance */}
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
              Step {ctx.title}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-foreground/80">{ctx.guidance}</p>
        </div>

        {/* Tips */}
        <div className="mb-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tips</h4>
          <ul className="space-y-1.5">
            {ctx.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Configuration validation */}
        <div className="mb-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Configuration Review
          </h4>
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-3">
            {configChecks.map((check, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {check.ok ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                )}
                <span className={cn(check.ok ? 'text-foreground/70' : 'text-amber-600 dark:text-amber-400')}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
          {missingItems.length > 0 && step !== 'connect' && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                {missingItems.length} item(s) need attention before you can connect.
              </p>
            </div>
          )}
        </div>

        {/* Connection guide (collapsible) */}
        <Accordion type="single" collapsible>
          <AccordionItem value="guide" className="border-0">
            <AccordionTrigger className="rounded-lg px-2 py-2 text-xs font-semibold hover:bg-muted/50">
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary" />
                Connection Guide
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-2">
              <div className="space-y-3">
                <GuideSection title="Connection Requirements" items={guide.requirements} />
                <GuideSection title="What OneKor Will Do" items={guide.whatOneKorDoes} numbered />
                <GuideSection title="What OneKor Will Not Do" items={guide.whatOneKorDoesNot} negative />
                <div>
                  <h5 className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Documentation</h5>
                  <div className="space-y-1">
                    {guide.documentation.map((doc, i) => (
                      <a
                        key={i}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {doc.label}
                      </a>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Troubleshooting</h5>
                  <div className="space-y-1.5">
                    {guide.troubleshooting.map((t, i) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/30 p-2">
                        <p className="text-[11px] font-medium text-foreground">{t.problem}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{t.solution}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

function GuideSection({ title, items, numbered, negative }) {
  return (
    <div>
      <h5 className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{title}</h5>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/70">
            {numbered ? (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{i + 1}</span>
            ) : negative ? (
              <span className="mt-0.5 shrink-0 text-red-500">✕</span>
            ) : (
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}