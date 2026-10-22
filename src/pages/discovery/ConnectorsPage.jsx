import { useState, useMemo } from 'react';
import { useNav } from '@/components/layout/AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { useDiscoverySources } from '@/lib/discovery/hooks';
import { CONNECTORS, CONNECTOR_CATEGORIES, CONNECTOR_SORTS } from '@/lib/discovery/connectors';
import { CONNECTOR_STATUS_META } from '@/lib/discovery/helpers';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Search, Plug, Clock, ArrowRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { pathFor } from '@/lib/navigation';

function ConnectorStatusBadge({ status }) {
  const meta = CONNECTOR_STATUS_META[status] || CONNECTOR_STATUS_META.coming_soon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', meta.bg, meta.color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

export default function ConnectorsPage() {
  const { panel, area, mod, feature } = useNav();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: sources = [], isLoading } = useDiscoverySources();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('name');
  const [view, setView] = useState('grid');

  // Map connector → source count and last sync
  const sourceCounts = useMemo(() => {
    const counts = {};
    const lastSyncs = {};
    for (const s of sources) {
      counts[s.connector_id] = (counts[s.connector_id] || 0) + 1;
      if (s.last_successful_scan && (!lastSyncs[s.connector_id] || new Date(s.last_successful_scan) > new Date(lastSyncs[s.connector_id]))) {
        lastSyncs[s.connector_id] = s.last_successful_scan;
      }
    }
    return { counts, lastSyncs };
  }, [sources]);

  const filteredConnectors = useMemo(() => {
    let result = [...CONNECTORS];
    if (category !== 'all') result = result.filter((c) => c.category === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.categoryLabel.toLowerCase().includes(q));
    }
    switch (sort) {
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'status': result.sort((a, b) => a.status.localeCompare(b.status)); break;
      case 'sources': result.sort((a, b) => (sourceCounts.counts[b.id] || 0) - (sourceCounts.counts[a.id] || 0)); break;
      case 'recently_used':
        result.sort((a, b) => {
          const aSync = sourceCounts.lastSyncs[a.id] ? new Date(sourceCounts.lastSyncs[a.id]).getTime() : 0;
          const bSync = sourceCounts.lastSyncs[b.id] ? new Date(sourceCounts.lastSyncs[b.id]).getTime() : 0;
          return bSync - aSync;
        });
        break;
      case 'recently_added':
        // Available ones first
        result.sort((a, b) => {
          const order = { available: 0, beta: 1, coming_soon: 2 };
          return (order[a.status] || 2) - (order[b.status] || 2);
        });
        break;
      default: break;
    }
    return result;
  }, [search, category, sort, sourceCounts]);

  const handleOpen = (connector) => {
    navigate(pathFor(panel.id, area.id, mod.id, 'connectors') + `?connector=${connector.id}`);
  };

  const handleViewSources = () => {
    navigate(pathFor(panel.id, area.id, mod.id, 'ai-sources'));
  };

  const connectedCount = Object.keys(sourceCounts.counts).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <feature.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{t(feature.name)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t(feature.desc)}</p>
          </div>
        </div>
        {connectedCount > 0 && (
          <Button variant="outline" onClick={handleViewSources} className="gap-2 shrink-0">
            <span className="rounded-full bg-emerald-500 h-2 w-2" />
            {connectedCount} Connected
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Filters + view toggle */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search connectors…" className="pl-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONNECTOR_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONNECTOR_SORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center rounded-lg border border-border">
          <button onClick={() => setView('grid')} className={cn('grid h-9 w-9 place-items-center rounded-l-lg', view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView('list')} className={cn('grid h-9 w-9 place-items-center rounded-r-lg border-l border-border', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      ) : filteredConnectors.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">No connectors match your search.</div>
      ) : view === 'grid' ? (
        /* ── Grid view ── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredConnectors.map((connector) => {
            const Icon = connector.icon;
            const isAvailable = connector.status === 'available' || connector.status === 'beta';
            const sourceCount = sourceCounts.counts[connector.id] || 0;
            const lastSync = sourceCounts.lastSyncs[connector.id];
            return (
              <div
                key={connector.id}
                onClick={() => handleOpen(connector)}
                className={cn(
                  'group relative flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all cursor-pointer',
                  isAvailable
                    ? 'hover:border-primary/30 hover:shadow-md hover:bg-card'
                    : 'opacity-75 hover:opacity-90'
                )}
                id={`connector-card-${connector.id}`}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm ring-1 ring-black/10"
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

                {/* Description */}
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{connector.description}</p>

                {/* Meta */}
                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Authentication</span>
                    <span className="font-medium text-foreground">{connector.authLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Discovers</span>
                    <span className="font-medium text-foreground truncate max-w-[130px] text-right">
                      {connector.capabilityLabels?.slice(0, 2).join(', ')}{connector.capabilityLabels?.length > 2 ? '…' : ''}
                    </span>
                  </div>
                  {sourceCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">AI Sources</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{sourceCount} active</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="mt-4 pt-1">
                  {isAvailable ? (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary group-hover:bg-primary/10 transition-colors">
                      <Plug className="h-3.5 w-3.5" />
                      {sourceCount > 0 ? 'Configure' : 'Connect'}
                      <ArrowRight className="ml-auto h-3.5 w-3.5 -translate-x-1 group-hover:translate-x-0 transition-transform" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Coming Soon
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table view ── */
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Connector</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Auth</th>
                <th className="px-4 py-3 font-medium">Discovers</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Sources</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredConnectors.map((c) => {
                const Icon = c.icon;
                const isAvailable = c.status === 'available' || c.status === 'beta';
                const sourceCount = sourceCounts.counts[c.id] || 0;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => handleOpen(c)}
                    id={`connector-row-${c.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ring-1 ring-black/10"
                          style={{ backgroundColor: c.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.categoryLabel}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.authLabel}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="line-clamp-1 text-xs">
                        {c.capabilityLabels?.slice(0, 3).join(', ')}{c.capabilityLabels?.length > 3 ? '…' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ConnectorStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-foreground">
                      {sourceCount > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{sourceCount}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAvailable ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpen(c); }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          {sourceCount > 0 ? 'Configure' : 'Connect'}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Soon</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}