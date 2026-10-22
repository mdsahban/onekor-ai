import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useNav } from './AppLayout';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/components/LanguageProvider';
import { base44 } from '@/api/base44Client';
import HeaderNav from './HeaderNav';
import LanguageSwitcher from './LanguageSwitcher';
import CommandSearch from './CommandSearch';
import Brand from './Brand';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Menu, Search, LogOut, User, ChevronDown, Sun, Moon } from 'lucide-react';

export default function Header() {
  const { setMobileOpen } = useNav();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const initials = (user?.full_name || user?.email || 'U')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/80 px-3 backdrop-blur-md sm:px-4">
      {/* mobile menu + brand */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-9 w-9"
        aria-label={t('Open menu')}
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="lg:hidden">
        <Brand />
      </div>

      {/* level 1 navigation */}
      <div className="flex-1 min-w-0">
        <HeaderNav />
      </div>

      {/* right cluster */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <CommandSearch>
          <Button variant="ghost" size="icon" aria-label={t('Search')} className="h-9 w-9 text-muted-foreground hover:text-foreground">
            <Search className="h-[18px] w-[18px]" />
          </Button>
        </CommandSearch>
        <LanguageSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors hover:bg-accent">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="hidden xl:flex items-center gap-1 text-sm font-medium">
                <span className="max-w-[120px] truncate">{user?.full_name || t('Account')}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-lg shadow-black/5" sideOffset={8}>
            <DropdownMenuLabel className="px-2 py-1.5">
              <div className="flex flex-col">
                <span className="truncate text-sm font-medium">{user?.full_name || t('Account')}</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-lg px-2 py-1.5 text-sm">
              <User className="mr-2 h-4 w-4" /> {t('Profile')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('Appearance')}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light" className="rounded-lg px-2 py-1.5 text-sm">
                <Sun className="mr-2 h-4 w-4" /> {t('Light')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="rounded-lg px-2 py-1.5 text-sm">
                <Moon className="mr-2 h-4 w-4" /> {t('Dark')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground"
              onClick={() => base44.auth.logout(window.location.origin)}
            >
              <LogOut className="mr-2 h-4 w-4" /> {t('Sign out')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}