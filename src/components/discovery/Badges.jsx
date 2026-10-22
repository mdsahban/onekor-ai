import { CONNECTION_STATUS_META, CONFIDENCE_META, CONNECTOR_STATUS_META, LOG_SEVERITY_META, RUN_STATUS_META } from '@/lib/discovery/helpers';
import { cn } from '@/lib/utils';

export function StatusBadge({ status, meta, className }) {
  const m = meta[status] || { label: status, color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', m.bg, m.color, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

export function ConnectionStatusBadge({ status, className }) {
  return <StatusBadge status={status} meta={CONNECTION_STATUS_META} className={className} />;
}

export function ConnectorStatusBadge({ status, className }) {
  return <StatusBadge status={status} meta={CONNECTOR_STATUS_META} className={className} />;
}

export function RunStatusBadge({ status, className }) {
  return <StatusBadge status={status} meta={RUN_STATUS_META} className={className} />;
}

export function ConfidenceBadge({ level, score, className }) {
  const m = CONFIDENCE_META[level] || CONFIDENCE_META.low;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', m.bg, m.color, className)}>
      {score != null && <span className="font-semibold">{Math.round(score * 100)}%</span>}
      <span>{m.label}</span>
    </span>
  );
}

export function LogSeverityBadge({ severity, className }) {
  const m = LOG_SEVERITY_META[severity] || LOG_SEVERITY_META.info;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', m.color, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}