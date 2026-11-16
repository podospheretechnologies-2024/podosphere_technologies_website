'use client';

import {
  OPS_SERVICE_CATEGORY_LABEL,
  type OpsServiceCategory,
} from '@/modules/social/server/ops/ops.constants';
import { formatInr, useOpsDashboard } from './ops-api';

const SERVICE_COLORS: Record<OpsServiceCategory, string> = {
  website: 'text-violet-700',
  social_media: 'text-pink-600',
  paid_ads: 'text-orange-600',
  ecommerce: 'text-blue-600',
  quick_commerce: 'text-emerald-600',
};

export function OpsDashboardTab({ monthKey }: { monthKey: string }) {
  const { data, error, isLoading } = useOpsDashboard(monthKey);

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading dashboard…</p>;
  if (error || !data) {
    return <p className="text-sm text-red-600">{error?.message ?? 'Failed to load'}</p>;
  }

  const { kpis } = data;

  return (
    <div className="space-y-5">
      <div className="border-border bg-surface grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4 lg:grid-cols-8">
        <Kpi label="Active clients" value={String(kpis.activeClients)} sub={`${kpis.totalClients} total`} />
        <Kpi
          label="Monthly retainer"
          value={formatInr(kpis.monthlyRetainer, true)}
          sub={`${kpis.retainerClientCount} retainer clients`}
        />
        <Kpi
          label={`To collect`}
          value={formatInr(kpis.toCollect, true)}
          sub={`${kpis.toCollectCount} payments`}
        />
        <Kpi label="Collected" value={formatInr(kpis.collected, true)} />
        <Kpi
          label="Overdue (all time)"
          value={formatInr(kpis.overdueAmount, true)}
          sub={`${kpis.overdueCount} payments`}
          tone="danger"
        />
        <Kpi label="Renewals due / 30d" value={String(kpis.renewalsDue)} />
        <Kpi
          label="Open escalations"
          value={String(kpis.openEscalations)}
          tone={kpis.openEscalations ? 'danger' : undefined}
        />
        <Kpi
          label="Avg collection delay"
          value={kpis.avgCollectionDelayDays == null ? '—' : `${kpis.avgCollectionDelayDays}d`}
          tone="warn"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Collections due (Next 14 days & overdue)">
          {data.collectionsDue.length === 0 ? (
            <Empty>No payments due in the next 14 days.</Empty>
          ) : (
            <ul className="divide-border divide-y">
              {data.collectionsDue.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{p.clientName}</span>
                  <span>{formatInr(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Retainer renewals">
          {data.renewals.length === 0 ? (
            <Empty>
              No renewals due. Add retainer start date and duration on each client to track this.
            </Empty>
          ) : (
            <ul className="divide-border divide-y">
              {data.renewals.map((r) => (
                <li key={r.client.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{r.client.name}</span>
                  <span className="text-muted-foreground">
                    {r.endsOn}
                    {r.daysLeft != null ? ` · ${r.daysLeft}d` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide uppercase">Services</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.serviceSummary.map((col) => (
            <div key={col.category} className="border-border bg-surface rounded-xl border p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h4 className={`text-sm font-semibold ${SERVICE_COLORS[col.category]}`}>
                  {OPS_SERVICE_CATEGORY_LABEL[col.category]}
                </h4>
                <span className={`text-2xl font-bold ${SERVICE_COLORS[col.category]}`}>
                  {col.totalClients}
                </span>
              </div>
              <ul className="space-y-1.5 text-sm">
                {col.subtypes.length === 0 ? (
                  <li className="text-muted-foreground">No clients yet</li>
                ) : (
                  col.subtypes.map((s) => (
                    <li key={`${s.groupLabel}-${s.subtype}`} className="flex justify-between gap-2">
                      <span className="text-muted-foreground truncate">
                        {s.groupLabel ? `${s.groupLabel}: ` : ''}
                        {s.subtype}
                      </span>
                      <span className="font-medium">{s.count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'danger' | 'warn';
}) {
  return (
    <div className="bg-surface px-3 py-3">
      <p className="text-muted-foreground text-[11px] leading-tight">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-orange-500' : ''
        }`}
      >
        {value}
      </p>
      {sub ? <p className="text-muted-foreground text-[11px]">{sub}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border bg-surface rounded-xl border p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}
