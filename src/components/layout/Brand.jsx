import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNav } from './AppLayout';
import { useBranding } from '@/components/BrandingProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { useTheme } from 'next-themes';
import { defaultPath } from '@/lib/navigation';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

export default function Brand({ compact = false }) {
  const { panel } = useNav();
  const { branding } = useBranding();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const logo = mounted && theme === 'dark' ? branding.logoDark : branding.logoLight;
  const initial = (branding.siteName || 'OK').charAt(0).toUpperCase();
  const displayName = branding.siteName || 'OneKor';
  const tagline = branding.tagline ? t(branding.tagline) : t('Enterprise Workspace');

  return (
    <Link
      to={defaultPath(panel.id)}
      className={cn(
        'group flex items-center gap-3 rounded-xl transition-colors',
        compact ? 'justify-center px-0' : 'px-2 py-1'
      )}
    >
      {logo ? (
        <Image src={logo} alt={displayName} fittingType="fit" className="h-8 w-auto max-w-[120px] shrink-0" />
      ) : (
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-sm shadow-primary/30 ring-1 ring-white/10">
          <span className="font-display text-sm font-semibold tracking-tight">{initial}</span>
        </span>
      )}
      {!compact && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-display text-[15px] font-semibold text-sidebar-foreground">{displayName}</span>
          <span className="truncate text-[11px] text-sidebar-foreground/60">{tagline}</span>
        </span>
      )}
    </Link>
  );
}