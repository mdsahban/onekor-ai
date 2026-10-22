import { ConnectorStatusBadge } from './Badges';
import { Button } from '@/components/ui/button';
import { Plug, Clock } from 'lucide-react';
import { formatRelative } from '@/lib/discovery/helpers';

export default function ConnectorCard({ connector, sourceCount, lastSync, onConfigure, onManage }) {
  const Icon = connector.icon;
  const isAvailable = connector.status === 'available' || connector.status === 'beta';

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: connector.color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold text-foreground">{connector.name}</h3>
          <p className="text-xs text-muted-foreground">{connector.categoryLabel}</p>
        </div>
        <ConnectorStatusBadge status={connector.status} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{connector.description}</p>

      <div className="mt-4 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Authentication</span>
          <span className="font-medium text-foreground">{connector.authLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Capabilities</span>
          <span className="font-medium text-foreground">{connector.capabilityLabels.join(', ')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Configured Sources</span>
          <span className="font-medium text-foreground">{sourceCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last Sync</span>
          <span className="font-medium text-foreground">{sourceCount > 0 ? formatRelative(lastSync) : '—'}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2 pt-1">
        {isAvailable ? (
          <Button size="sm" className="flex-1 gap-2" onClick={onConfigure}>
            <Plug className="h-3.5 w-3.5" />
            {sourceCount > 0 ? 'Configure' : 'Connect'}
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled className="flex-1 gap-2">
            <Clock className="h-3.5 w-3.5" />
            Coming Soon
          </Button>
        )}
        {sourceCount > 0 && (
          <Button size="sm" variant="outline" onClick={onManage}>
            Manage ({sourceCount})
          </Button>
        )}
      </div>
    </div>
  );
}