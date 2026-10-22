import { useNav } from './AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import Brand from './Brand';
import PanelSwitcher from './PanelSwitcher';
import { pathFor, isFeatureLive } from '@/lib/navigation';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from
'@/components/ui/tooltip';

export default function Sidebar() {
  const { panel, area, mod, collapsed, setCollapsed } = useNav();
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <aside
      className={cn(
        'relative hidden shrink-0 flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out lg:flex',
        collapsed ? 'w-[72px]' : 'w-64'
      )}>

      {/* brand */}
      <div className={cn('flex h-16 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Brand compact={collapsed} />
      </div>

      {/* hierarchy heading + feature nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className={cn('mb-2 px-2', collapsed && 'hidden')}>
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{t(mod.name)}</p>
        </div>

        <nav className="flex flex-col gap-0.5">
          <TooltipProvider delayDuration={150}>
            {mod.features.map((item) => {
              const active = location.pathname === pathFor(panel.id, area.id, mod.id, item.id);
              const live = isFeatureLive(panel, area, mod);
              const link =
              <Link
                key={item.id}
                to={pathFor(panel.id, area.id, mod.id, item.id)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  active ?
                  'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' :
                  'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}>

                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed &&
                <span className="flex-1 truncate">{t(item.name)}</span>
                }
                  {!collapsed && !live &&
                <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent-foreground/70">
                      {t('Soon')}
                    </span>
                }
                  {active && !collapsed &&
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                }
                </Link>;

              if (!collapsed) return link;
              return (
                <Tooltip key={item.id} side="right">
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{t(item.name)}</TooltipContent>
                </Tooltip>);

            })}
          </TooltipProvider>
        </nav>
      </div>

      {/* panel switcher */}
      <div className="border-t border-sidebar-border p-3">
        <PanelSwitcher collapsed={collapsed} />
      </div>

      {/* collapse control — compact icon fixed to bottom */}
      <div className="border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'flex w-full items-center justify-center gap-2 py-3 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
          )}
          aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}>
          {collapsed
            ? <PanelLeftOpen className="h-[18px] w-[18px]" />
            : <PanelLeftClose className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </aside>);

}