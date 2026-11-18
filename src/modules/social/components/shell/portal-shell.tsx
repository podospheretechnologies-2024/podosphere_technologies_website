'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KeyRound, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { apiFetch } from '@/shared/lib/fetcher';
import { cn } from '@/shared/lib/cn';
import { getPortalTab, type PortalTabId } from '../../config/portal-tabs';
import { IconRail, iconRailItemClass, type IconRailItem } from './icon-rail';

export type PortalBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  portalTitle: string;
};

/** Serializable nav entry — icons resolve on the client from `portal-tabs`. */
export type PortalNavItem = {
  id: PortalTabId;
  label: string;
  href: string;
};

type Props = {
  branding: PortalBranding;
  nav: PortalNavItem[];
  /** The client's own name, shown where the agency app shows the client switcher. */
  clientName?: string;
  children: ReactNode;
};

const PASSWORD_HREF = '/approver/change-password';
const THEME_STORAGE_KEY = 'podosphere-portal-theme';

type PortalTheme = 'dark' | 'light';

function ThemeSwitch({
  theme,
  onChange,
}: {
  theme: PortalTheme;
  onChange: (next: PortalTheme) => void;
}) {
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ] as const;
  return (
    <div
      role="group"
      aria-label="Color mode"
      className="border-border bg-surface-muted/60 flex h-7 items-center rounded-md border p-px"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={theme === value}
          title={`${label} mode`}
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] leading-none font-medium transition',
            theme === value
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="size-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Client portal chrome. Same layout as the agency app (`SocialShell`): left icon rail, top header,
 * Light / Dark switch, rounded content card — but only the tabs the agency switched on, and no
 * client switcher. Opens in light mode; the client's choice is kept in the browser.
 * Phone width: top bar + menu sheet + bottom bar instead of the rail.
 */
export function PortalShell({ branding, nav, clientName, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [theme, setTheme] = useState<PortalTheme>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  function changeTheme(next: PortalTheme) {
    setTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  async function logout() {
    setLoggingOut(true);
    await apiFetch('/api/portal/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const railItems: IconRailItem[] = nav.flatMap((item) => {
    const icon = getPortalTab(item.id)?.icon;
    return icon ? [{ key: item.id, label: item.label, href: item.href, icon }] : [];
  });
  const current = nav.find((item) => isActive(item.href));
  const homeHref = nav[0]?.href ?? '/portal';
  const initial = (branding.name || 'P').slice(0, 1).toUpperCase();

  const logo = branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- agency-uploaded logo URL
    <img src={branding.logoUrl} alt="" className="size-full object-contain" />
  ) : (
    initial
  );

  // The agency's own colour drives the accents. With none set, the admin purple stays.
  const themeStyle = branding.primaryColor
    ? ({ '--primary': branding.primaryColor } as CSSProperties)
    : undefined;

  return (
    <div
      className={cn(
        'theme-social bg-background text-foreground relative flex min-h-screen flex-col md:p-3',
        theme === 'light' && 'theme-social-light'
      )}
      style={themeStyle}
    >
      {/* Phone top bar */}
      <header className="bg-surface border-border sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-bold">
            {logo}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{current?.label ?? branding.portalTitle}</p>
            {clientName ? (
              <p className="text-muted-foreground truncate text-[11px]">{clientName}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className="hover:bg-surface-muted rounded-lg p-2"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>

      {/* Phone menu sheet: every enabled tab */}
      {mobileOpen ? (
        <div className="bg-surface fixed inset-0 z-40 overflow-y-auto md:hidden">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">{branding.portalTitle}</span>
            <button
              type="button"
              aria-label="Close menu"
              className="hover:bg-surface-muted rounded-lg p-2"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-2">
            {railItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                    isActive(item.href)
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-border space-y-1 border-t p-2">
            <div className="px-3 py-2">
              <ThemeSwitch theme={theme} onChange={changeTheme} />
            </div>
            <Link
              href={PASSWORD_HREF}
              onClick={() => setMobileOpen(false)}
              className="text-muted-foreground flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
            >
              <KeyRound className="size-5" />
              Password
            </Link>
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => void logout()}
              className="text-muted-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
            >
              <LogOut className="size-5" />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-2">
        <IconRail
          className="sticky top-3 hidden max-h-[calc(100vh-1.5rem)] self-start md:flex"
          items={railItems}
          homeHref={homeHref}
          brand={logo}
          footer={
            <>
              <Link href={PASSWORD_HREF} title="Password" className={iconRailItemClass(false)}>
                <KeyRound className="size-5" />
                <span className="leading-tight">Password</span>
              </Link>
              <button
                type="button"
                title="Sign out"
                disabled={loggingOut}
                onClick={() => void logout()}
                className={iconRailItemClass(false)}
              >
                <LogOut className="size-5" />
                <span className="leading-tight">{loggingOut ? 'Wait…' : 'Sign out'}</span>
              </button>
            </>
          }
        />

        <div className="md:bg-border flex min-w-0 flex-1 flex-col gap-px overflow-x-hidden md:rounded-xl">
          {/* Desktop header — same as the agency app, with the client's name instead of the switcher */}
          <header className="bg-surface hidden h-16 shrink-0 items-center gap-4 px-5 md:flex">
            <Link href={homeHref} className="flex shrink-0 items-center gap-2.5 font-semibold">
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center overflow-hidden rounded-lg text-sm font-bold">
                {logo}
              </span>
              <span className="text-base font-bold">{branding.portalTitle}</span>
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">
              {current?.label ?? 'Client portal'}
            </h1>
            <ThemeSwitch theme={theme} onChange={changeTheme} />
            <div className="min-w-0 text-right leading-tight">
              <p className="truncate text-sm font-medium">{clientName || 'Client portal'}</p>
              <p className="text-muted-foreground truncate text-xs">{branding.name}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              title="Sign out"
              className="text-muted-foreground hover:bg-surface-muted hover:text-foreground shrink-0 rounded-lg p-2 transition"
            >
              <LogOut className="size-4" />
            </button>
          </header>

          <main className="bg-surface min-w-0 flex-1 overflow-x-hidden p-4 pb-24 md:p-5 md:pb-5">
            <div className="mx-auto w-full min-w-0 max-w-full">{children}</div>
          </main>
        </div>
      </div>

      {/* Phone bottom bar — first 5 enabled tabs */}
      <nav className="border-border bg-surface fixed inset-x-0 bottom-0 z-20 flex border-t md:hidden">
        {railItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold',
                isActive(item.href) ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
