'use client';

import { CircleDollarSign, Handshake, Settings, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { socialAppHome, socialAppNav } from '../../config/app-nav';
import { SOCIAL_BASE_PATH } from '../../config/navigation';

export type IconRailItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

const bottomItems: IconRailItem[] = [
  {
    key: 'affiliate',
    label: 'Affiliate',
    href: `${SOCIAL_BASE_PATH}/settings`,
    icon: Handshake,
  },
  {
    key: 'billing',
    label: 'Billing',
    href: `${SOCIAL_BASE_PATH}/settings`,
    icon: CircleDollarSign,
  },
  {
    key: 'settings',
    label: 'Settings',
    href: `${SOCIAL_BASE_PATH}/settings`,
    icon: Settings,
  },
];

/** Shared look of one rail entry, so the client portal's own buttons match the links. */
export function iconRailItemClass(active: boolean): string {
  return cn(
    'flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition',
    active
      ? 'bg-foreground text-background'
      : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
  );
}

/**
 * The left icon rail. With no props it is the agency rail. The client portal passes its own
 * `items` (only the tabs the agency switched on), `homeHref`, `brand` and `footer`.
 */
export function IconRail({
  items,
  homeHref,
  brand,
  footer,
  className,
}: {
  organizationName?: string;
  organizationSlug?: string;
  items?: IconRailItem[];
  homeHref?: string;
  /** Replaces the "P" square at the top. */
  brand?: ReactNode;
  /** Replaces the agency bottom links (Affiliate / Billing / Settings). */
  footer?: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const mainItems = items ?? socialAppNav.filter((item) => item.key !== 'settings');
  const isAgencyRail = !items;

  function renderItem(item: IconRailItem) {
    const Icon = item.icon;
    const isSettingsRoute =
      pathname === `${SOCIAL_BASE_PATH}/settings` ||
      pathname.startsWith(`${SOCIAL_BASE_PATH}/settings/`);
    const active =
      isAgencyRail && item.key === 'settings'
        ? isSettingsRoute
        : isAgencyRail && (item.key === 'affiliate' || item.key === 'billing')
          ? false
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link key={item.key} href={item.href} title={item.label} className={iconRailItemClass(active)}>
        <Icon className="size-5" />
        <span className="leading-tight">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside
      className={cn('bg-surface flex w-20 shrink-0 flex-col items-center rounded-xl py-3', className)}
    >
      <Link
        href={homeHref ?? socialAppHome}
        className="bg-primary text-primary-foreground mb-6 flex size-10 items-center justify-center overflow-hidden rounded-xl text-sm font-bold"
        title={isAgencyRail ? 'Podosphere' : 'Home'}
      >
        {brand ?? 'P'}
      </Link>
      <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
        {mainItems.map(renderItem)}
      </nav>
      <div className="border-border mt-auto w-full space-y-1 border-t px-2 pt-2">
        {footer ?? bottomItems.map(renderItem)}
      </div>
    </aside>
  );
}
