import { ConnectionStatusBadge } from './Badges';
import { getConnector } from '@/lib/discovery/connectors';
import { formatRelative, formatSchedule } from '@/lib/discovery/helpers';
import { cn } from '@/lib/utils';
import {
  Play, MoreVertical, Loader2, Pencil, Power, PowerOff,
  Copy, FileText, Trash2, Plug, ChevronUp, ChevronDown, AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const SORT_COLS = {
  name: 'Source',
  connector: 'Connector',
  status: 'Status',
  last_scan: 'Last Scan',
  assets: 'Assets',
  schedule: 'Schedule',
};

function SortHeader({ col, label, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th
      className="px-4 py-3 font-medium cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={cn('ml-0.5', active ? 'text-primary' : 'text-muted-foreground/40')}>
          {active && sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </div>
    </th>
  );
}

export default function SourceTable({
  sources, selectedIds, onSelectAll, onSelectOne,
  onOpen, onRun, onTest, onEdit, onToggle, onDuplicate, onDelete,
  runningIds, testingIds, sortCol, sortDir, onSort,
}) {
  const allSelected = sources.length > 0 && sources.every((s) => selectedIds?.has(s.id));
  const someSelected = sources.some((s) => selectedIds?.has(s.id));

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                onChange={(e) => onSelectAll?.(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
              />
            </th>
            {Object.entries(SORT_COLS).map(([col, label]) => (
              <SortHeader
                key={col} col={col} label={label}
                sortCol={sortCol} sortDir={sortDir} onSort={onSort}
              />
            ))}
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => {
            const connector = getConnector(source.connector_id);
            const Icon = connector?.icon;
            const isRunning = runningIds?.includes(source.id);
            const isTesting = testingIds?.includes(source.id);
            const isSelected = selectedIds?.has(source.id);
            const needsAttention =
              source.connection_status === 'error' ||
              source.connection_status === 'authentication_failed' ||
              source.connection_status === 'permission_denied' ||
              source.errors_count > 0;

            return (
              <tr
                key={source.id}
                className={cn(
                  'border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20',
                  isSelected && 'bg-primary/5',
                  source.enabled === false && 'opacity-60',
                )}
              >
                {/* Checkbox */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected || false}
                    onChange={(e) => onSelectOne?.(source, e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                  />
                </td>

                {/* Source name */}
                <td
                  className="cursor-pointer px-4 py-3"
                  onClick={() => onOpen(source)}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ring-1 ring-black/10"
                      style={{ backgroundColor: connector?.color || '#6b7280' }}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium text-foreground hover:text-primary transition-colors">
                          {source.name}
                        </p>
                        {needsAttention && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {source.enabled !== false ? 'Enabled' : 'Disabled'}
                        {source.config?.environment ? ` · ${source.config.environment}` : ''}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Connector */}
                <td className="px-4 py-3 text-muted-foreground">
                  {connector?.name || source.connector_id}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <ConnectionStatusBadge status={source.connection_status} />
                </td>

                {/* Last Scan */}
                <td className="px-4 py-3 text-muted-foreground">
                  {formatRelative(source.last_successful_scan || source.last_scan_at)}
                </td>

                {/* Assets */}
                <td className="px-4 py-3 text-center">
                  <span className="font-semibold text-foreground">{source.assets_discovered ?? '—'}</span>
                  {source.new_assets > 0 && (
                    <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">+{source.new_assets}</span>
                  )}
                </td>

                {/* Schedule */}
                <td className="px-4 py-3 text-muted-foreground">
                  {formatSchedule(source.scan_frequency)}
                </td>

                {/* Actions */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm" variant="ghost" className="h-8 w-8 p-0"
                      onClick={() => onRun(source)}
                      disabled={isRunning || !source.enabled || source.connection_status !== 'connected'}
                      title="Run discovery"
                    >
                      {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-8 w-8 p-0"
                      onClick={() => onTest(source)}
                      disabled={isTesting}
                      title="Test connection"
                    >
                      {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => onOpen(source)}>
                          Open Detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(source)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit Configuration
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggle(source)}>
                          {source.enabled
                            ? <><PowerOff className="mr-2 h-4 w-4" /> Disable</>
                            : <><Power className="mr-2 h-4 w-4" /> Enable</>
                          }
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
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}