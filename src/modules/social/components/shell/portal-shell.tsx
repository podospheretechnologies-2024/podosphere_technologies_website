'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KeyRound, LogOut, Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { apiFetch } from '@/shared/lib/fetcher';
import { cn } from '@/shared/lib/cn';
import { getPortalTab, type PortalTabId } from '../../config/portal-tabs';

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
  children: ReactNode;
};

export function PortalShell({ branding, nav, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await apiFetch('/api/portal/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function renderIcon(id: PortalTabId) {
    const Icon = getPortalTab(id)?.icon;
    return Icon ? <Icon className="size-5" /> : null;
  }

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
            isActive(item.href)
              ? 'bg-white/15 text-white'
              : 'text-white/75 hover:bg-white/10 hover:text-white'
          )}
        >
          <span className="flex size-5 shrink-0 items-center justify-center">{renderIcon(item.id)}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col text-white md:flex"
        style={{ backgroundColor: branding.primaryColor }}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- agency-uploaded logo URL
            <img src={branding.logoUrl} alt="" className="h-8 max-w-[7rem] rounded object-contain" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
              {(branding.name || 'P').slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{branding.portalTitle}</p>
            <p className="truncate text-[11px] text-white/60">Client portal</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">{navLinks}</div>
        <div className="space-y-1 border-t border-white/10 px-2 py-3">
          <Link
            href="/approver/change-password"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <KeyRound className="size-5" />
            Password
          </Link>
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-5" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 text-white md:hidden"
        style={{ backgroundColor: branding.primaryColor }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-7 rounded object-contain" />
          ) : null}
          <span className="truncate text-sm font-semibold">{branding.portalTitle}</span>
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className="rounded-lg p-2 hover:bg-white/10"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-white">{branding.portalTitle}</span>
            <button
              type="button"
              aria-label="Close menu"
              className="rounded-lg p-2 text-white hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="px-2 py-2">{navLinks}</div>
          <div className="mt-4 space-y-1 border-t border-white/10 px-2 py-3">
            <Link
              href="/approver/change-password"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75"
            >
              <KeyRound className="size-5" />
              Password
            </Link>
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75"
            >
              <LogOut className="size-5" />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}

      <main className="md:pl-56">
        <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-8">{children}</div>
      </main>

      {/* Mobile bottom nav — first 5 enabled tabs */}
      <nav className="border-border bg-white fixed inset-x-0 bottom-0 z-20 flex border-t md:hidden">
        {nav.slice(0, 5).map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold',
              isActive(item.href) ? 'text-gray-900' : 'text-gray-400'
            )}
          >
            <span className="flex size-5 items-center justify-center">{renderIcon(item.id)}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
