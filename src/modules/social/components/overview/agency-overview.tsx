'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  Contact,
  FileEdit,
  Inbox,
  IndianRupee,
  Users,
  UserRound,
} from 'lucide-react';
import { SOCIAL_BASE_PATH } from '../../config/navigation';
import { useAgencyOverview } from '../../hooks/use-overview';
import { useClientScope } from '../../hooks/use-client-scope';

function formatCount(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-IN');
}

function formatSpend(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function AgencyOverviewPanel() {
  const { selectedClientId, clients } = useClientScope();
  const { data, error, isLoading } = useAgencyOverview();
  const label = selectedClientId
    ? (clients.find((c) => c.id === selectedClientId)?.name ?? 'Selected client')
    : 'All clients';

  const cards = [
    {
      key: 'postsDue',
      label: 'Posts due (7d)',
      value: formatCount(data?.postsDue),
      href: `${SOCIAL_BASE_PATH}/calendar`,
      icon: CalendarClock,
    },
    {
      key: 'drafts',
      label: 'Drafts',
      value: formatCount(data?.drafts),
      href: `${SOCIAL_BASE_PATH}/calendar`,
      icon: FileEdit,
    },
    {
      key: 'leads',
      label: 'Leads',
      value: formatCount(data?.leads),
      href: `${SOCIAL_BASE_PATH}/leads`,
      icon: Contact,
    },
    {
      key: 'inboxWaiting',
      label: 'Inbox waiting',
      value: formatCount(data?.inboxWaiting),
      href: `${SOCIAL_BASE_PATH}/inbox`,
      icon: Inbox,
    },
    {
      key: 'syncErrors',
      label: 'Sync errors',
      value: formatCount(data?.syncErrors),
      href: `${SOCIAL_BASE_PATH}/channels`,
      icon: AlertTriangle,
    },
    {
      key: 'spend30d',
      label: 'Ad spend (30d)',
      value: formatSpend(data?.spend30d),
      href: `${SOCIAL_BASE_PATH}/ads`,
      icon: IndianRupee,
    },
    {
      key: 'followers',
      label: 'Followers',
      value: formatCount(data?.followers),
      href: `${SOCIAL_BASE_PATH}/analytics`,
      icon: UserRound,
    },
    {
      key: 'clients',
      label: 'Clients',
      value: formatCount(data?.clients),
      href: `${SOCIAL_BASE_PATH}/clients`,
      icon: Users,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">Agency overview · {label}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Counts from stored MySQL data only — no live Meta calls.
        </p>
      </div>

      {error && (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load overview'}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.key}
              href={card.href}
              className="border-border bg-surface-muted/40 hover:bg-surface-muted/70 flex flex-col gap-3 rounded-xl border p-4 transition"
            >
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                <Icon className="size-3.5" />
                {card.label}
              </div>
              <p className="text-2xl font-semibold tabular-nums">
                {isLoading && !data ? '…' : card.value}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
