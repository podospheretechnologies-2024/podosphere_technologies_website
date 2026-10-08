'use client';

import { CircleDollarSign, Handshake, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { socialAppHome, socialAppNav } from '../../config/app-nav';
import { SOCIAL_BASE_PATH } from '../../config/navigation';

const bottomItems = [
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
] as const;

export function IconRail({ organizationName }: { organizationName?: string }) {
  const pathname = usePathname();
  const mainItems = socialAppNav.filter((item) => {
    if (item.key === 'settings') return false;
    if (item.key === 'ads' && organizationName !== 'Podosphere Technologies') return false;
    return true;
  });

  function renderItem(item: {
    key: string;
    label: string;
    href: string;
    icon: typeof Settings;
  }) {
    const Icon = item.icon;
    const isSettingsRoute =
      pathname === `${SOCIAL_BASE_PATH}/settings` ||
      pathname.startsWith(`${SOCIAL_BASE_PATH}/settings/`);
    const active =
      item.key === 'settings'
        ? isSettingsRoute
        : item.key === 'affiliate' || item.key === 'billing'
          ? false
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.key}
        href={item.href}
        title={item.label}
        className={cn(
          'flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition',
          active
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
        )}
      >
        <Icon className="size-5" />
        <span className="leading-tight">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="bg-surface flex w-20 shrink-0 flex-col items-center rounded-xl py-3">
      <Link
        href={socialAppHome}
        className="bg-primary text-primary-foreground mb-6 flex size-10 items-center justify-center rounded-xl text-sm font-bold"
        title="Podosphere"
      >
        P
      </Link>
      <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
        {mainItems.map(renderItem)}
      </nav>
      <div className="border-border mt-auto w-full space-y-1 border-t px-2 pt-2">
        {bottomItems.map(renderItem)}
      </div>
    </aside>
  );
}
