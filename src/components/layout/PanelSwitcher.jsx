import { useNavigate } from 'react-router-dom';
import { useNav } from './AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { panels, defaultPath } from '@/lib/navigation';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup } from
'@/components/ui/dropdown-menu';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PanelSwitcher({ collapsed = false, onSwitch }) {
  const { panel } = useNav();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const go = (panelId) => {
    navigate(defaultPath(panelId));
    onSwitch?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent',
            collapsed && 'justify-center px-0'
          )}>

          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <panel.icon className="h-4 w-4" />
          </span>
          {!collapsed &&
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold text-sidebar-foreground">{t(panel.name)}</span>
              <span className="truncate text-[11px] text-sidebar-foreground/60">{t('Switch panel')}</span>
            </span>
          }
          {!collapsed && <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align={collapsed ? 'start' : 'end'}
        className="w-64 rounded-xl border-border/80 p-1.5 shadow-lg shadow-black/5"
        sideOffset={8}>

        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('Panels')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={panel.id}>
          {panels.map((p) =>
          <DropdownMenuItem
            key={p.id}
            onSelect={() => go(p.id)}
            className="rounded-lg px-2 py-2">

              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <p.icon className="h-4 w-4" />
              </span>
              <span className="flex flex-1 flex-col leading-tight">
                <span className="text-sm font-medium">{t(p.name)}</span>

              </span>
              {panel.id === p.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>);

}