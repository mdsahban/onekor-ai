import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNav } from './AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { panels, pathFor } from '@/lib/navigation';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { CornerDownLeft } from 'lucide-react';

export default function CommandSearch({ children }) {
  const [open, setOpen] = useState(false);
  const { panel } = useNav();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener(onKey, onKey);
  }, []);

  const go = (panelId, areaId, moduleId, featureId) => {
    navigate(pathFor(panelId, areaId, moduleId, featureId));
    setOpen(false);
  };

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {children}
      </span>
      <CommandDialog open={open} onOpenChange={setOpen} className="rounded-2xl">
        <CommandInput placeholder={`${t('Search')} ${t(panel.name)}…`} />
        <CommandList>
          <CommandEmpty>{t('No results found.')}</CommandEmpty>
          {panel.areas.map((area) => (
            <CommandGroup key={area.id} heading={`${t(panel.name)} · ${t(area.name)}`}>
              {area.modules.flatMap((m) =>
                m.features.map((f) => (
                  <CommandItem
                    key={`${area.id}-${m.id}-${f.id}`}
                    value={`${t(panel.name)} ${t(area.name)} ${t(m.name)} ${t(f.name)}`}
                    onSelect={() => go(panel.id, area.id, m.id, f.id)}
                    className="gap-2.5"
                  >
                    <f.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{t(f.name)}</span>
                    <span className="text-xs text-muted-foreground">{t(m.name)}</span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          ))}
          <CommandGroup heading={t('Switch panel')}>
            {panels
              .filter((p) => p.id !== panel.id)
              .map((p) => (
                <CommandItem
                  key={p.id}
                  value={`panel ${t(p.name)}`}
                  onSelect={() => go(p.id, p.areas[0].id, p.areas[0].modules[0].id, p.areas[0].modules[0].features[0].id)}
                  className="gap-2.5"
                >
                  <p.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{t(p.name)}</span>
                  <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}