import { useNav } from './AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import Brand from './Brand';
import PanelSwitcher from './PanelSwitcher';
import { pathFor, isFeatureLive } from '@/lib/navigation';
import { Link, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function MobileSidebar() {
  const { panel, area, mod, mobileOpen, setMobileOpen } = useNav();
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 lg:hidden">
        <SheetHeader className="flex h-16 flex-row items-center border-b border-sidebar-border px-4">
          <SheetTitle className="text-left">
            <Brand />
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="px-3 py-4">
            <div className="mb-2 px-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{t(panel.name)}</p>
              <p className="truncate text-xs font-medium text-sidebar-foreground/60">{t(area.name)}</p>
              <p className="truncate text-sm font-semibold text-sidebar-foreground">{t(mod.name)}</p>
            </div>
            <nav className="flex flex-col gap-0.5">
              {mod.features.map((item) => {
                const active = location.pathname === pathFor(panel.id, area.id, mod.id, item.id);
                const live = isFeatureLive(panel, area, mod);
                return (
                  <Link
                    key={item.id}
                    to={pathFor(panel.id, area.id, mod.id, item.id)}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 truncate">{t(item.name)}</span>
                    {!live && (
                      <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent-foreground/70">
                        {t('Soon')}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </ScrollArea>

        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-3">
          <PanelSwitcher collapsed={false} onSwitch={() => setMobileOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}