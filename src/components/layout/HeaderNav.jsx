import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNav } from './AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { moduleDefaultPath } from '@/lib/navigation';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from
'@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HeaderNav() {
  const { panel, area } = useNav();
  const { t } = useLanguage();
  const [openId, setOpenId] = useState(null);

  return (
    <nav className="hidden items-center gap-0.5 lg:flex">
      {panel.areas.map((areaItem) => {
        const active = area.id === areaItem.id;
        return (
          <DropdownMenu key={areaItem.id} open={openId === areaItem.id} onOpenChange={(o) => setOpenId(o ? areaItem.id : null)}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'group flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ?
                  'bg-accent text-foreground' :
                  'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}>

                <areaItem.icon className="h-4 w-4 opacity-80" />
                <span>{t(areaItem.name)}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-50 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-64 rounded-xl border-border/80 p-1.5 shadow-lg shadow-black/5"
              sideOffset={8}>

              


              
              
              {areaItem.modules.map((m) =>
              <DropdownMenuItem key={m.id} asChild className="rounded-lg px-2 py-1.5">
                  <Link to={moduleDefaultPath(panel.id, areaItem.id, m.id)} className="flex items-center gap-2.5">
                    <m.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{t(m.name)}</span>

                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>);

      })}
    </nav>);

}