import { ConnectionStatusBadge } from './Badges';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Play, Plug, Pencil, PowerOff, Power, Copy, FileText, Trash2,
  MoreVertical, Loader2, AlertTriangle, ChevronRight, Activity,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getConnector } from '@/lib/discovery/connectors';
import { formatRelative, formatSchedule } from '@/lib/discovery/helpers';
import { cn } from '@/lib/utils';

function AttentionDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
    </span>
  );
}

export default function SourceCard({
  source, selected, onSelect,
  onOpen, onRun, onTest, onEdit, onToggle, onDuplicate, onDelete,
  testing, running,
}) {
  const connector = getConnector(source.connector_id);
  const Icon = connector?.icon;

  const needsAttention =
    source.connection_status === 'error' ||
    source.connection_status === 'authentication_failed' ||
    source.connection_status === 'permission_denied' ||
    (source.errors_count > 0);

  const isConnected = source.connection_status === 'connected';
  const isDisabled = source.enabled === false;

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border bg-card shadow-sm transition-all',
        selected
          ? 'border-primary ring-2 ring-primary/20'
          : needsAttention
            ? 'border-amber-200 hover:border-amber-300 dark:border-amber-800 dark:hover:border-amber-700'
            : 'border-border/70 hover:border-primary/30 hover:shadow-md',
        isDisabled && 'opacity-60',
      )}
    >
      {/* Attention stripe */}
      {needsAttention && (
        <div className="h-0.5 rounded-t-2xl bg-gradient-to-r from-amber-400 to-orange-400" />
      )}

      <div className="flex flex-col flex-1 p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(source, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
            id={`source-select-${source.id}`}
          />
          {/* Brand icon */}
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm ring-1 ring-black/10"
            style={{ backgroundColor: connector?.color || '#6b7280' }}
          >
            {Icon && <Icon className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3
                className="truncate font-display text-base font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => onOpen(source)}
              >
                {source.name}
              </h3>
              {needsAttention && <AttentionDot />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {connector?.name || source.connector_id}
              {source.config?.environment ? ` · ${source.config.environment}` : ''}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <ConnectionStatusBadge status={source.connection_status} />
            <Switch
              checked={source.enabled !== false}
              onCheckedChange={() => onToggle(source)}
              className="scale-75"
            />
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-border/50 rounded-xl border border-border/50 bg-muted/20">
          <StatCell
            label="Assets"
            value={source.assets_discovered ?? '—'}
            icon={<Activity className="h-3 w-3" />}
          />
          <StatCell
            label="Last scan"
            value={formatRelative(source.last_successful_scan || source.last_scan_at)}
          />
          <StatCell
            label="Schedule"
            value={formatSchedule(source.scan_frequency)}
          />
        </div>

        {/* Error summary */}
        {needsAttention && source.errors_count > 0 && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {source.errors_count} error{source.errors_count > 1 ? 's' : ''} in last run
          </div>
        )}

        {/* Action row */}
        <div className="mt-4 flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => onOpen(source)}
            id={`source-open-${source.id}`}
          >
            Open <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onRun(source)}
            disabled={running || !source.enabled || !isConnected}
            id={`source-run-${source.id}`}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? 'Running' : 'Run'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onTest(source)}
            disabled={testing}
            title="Test connection"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEdit(source)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Configuration
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggle(source)}>
                {source.enabled ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                {source.enabled ? 'Disable Source' : 'Enable Source'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(source)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpen(source, 'logs')}>
                <FileText className="mr-2 h-4 w-4" /> View Logs
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(source)}
                className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:text-red-400 dark:focus:bg-red-950/40"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, icon }) {
  return (
    <div className="flex flex-col items-center py-2 px-3 text-center">
      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground">{value ?? '—'}</span>
    </div>
  );
}