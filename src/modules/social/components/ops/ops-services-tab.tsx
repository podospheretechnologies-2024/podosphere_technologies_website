'use client';

import { useMemo, useState } from 'react';
import {
  monthLabel,
  OPS_CLIENT_STATUS_LABEL,
  OPS_SERVICE_CATEGORIES,
  OPS_SERVICE_CATEGORY_LABEL,
  type OpsServiceCategory,
} from '@/modules/social/server/ops/ops.constants';
import { formatInr, useOpsClients, useOpsServices } from './ops-api';

export function OpsServicesTab({ monthKey }: { monthKey: string }) {
  const [category, setCategory] = useState<OpsServiceCategory>('website');
  const { data, error, isLoading } = useOpsServices(category, monthKey);
  const { data: clients = [] } = useOpsClients();

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(OPS_SERVICE_CATEGORIES.map((c) => [c, 0])) as Record<
      OpsServiceCategory,
      number
    >;
    for (const client of clients) {
      const seen = new Set<string>();
      for (const s of client.services) {
        if (!seen.has(s.category)) {
          counts[s.category] += 1;
          seen.add(s.category);
        }
      }
    }
    return counts;
  }, [clients]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {OPS_SERVICE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              category === c
                ? 'bg-blue-600 text-white'
                : 'border-border bg-surface text-muted-foreground border'
            }`}
          >
            {OPS_SERVICE_CATEGORY_LABEL[c]} — {categoryCounts[c]}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MiniKpi label="Total clients" value={String(data.kpis.totalClients)} />
            <MiniKpi label="Active" value={String(data.kpis.activeClients)} />
            <MiniKpi
              label="Monthly fee"
              value={formatInr(data.kpis.monthlyFee, true)}
              sub={`${data.kpis.feeEnteredCount} of ${data.kpis.totalClients} have a fee`}
            />
            <MiniKpi
              label={`Escalations — ${monthLabel(monthKey)}`}
              value={String(data.kpis.escalations)}
              tone="danger"
            />
            <MiniKpi
              label={`Work delayed — ${monthLabel(monthKey)}`}
              value={String(data.kpis.workDelayed)}
              tone="warn"
            />
          </div>

          <div className="border-border bg-surface rounded-xl border p-4">
            <h3 className="mb-2 text-sm font-semibold">Service</h3>
            <ul className="space-y-1.5 text-sm">
              {data.subtypes.length === 0 ? (
                <li className="text-muted-foreground">No subtypes yet for this category.</li>
              ) : (
                data.subtypes.map((s) => (
                  <li key={s.subtype} className="flex justify-between">
                    <span className="text-muted-foreground">{s.subtype}</span>
                    <span className="font-semibold">{s.count}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted/50 text-muted-foreground text-left text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Service Fee / Mo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Work — {monthLabel(monthKey)}</th>
                  <th className="px-4 py-3">Escalation</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.clients.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {c.services.map((s) => s.subtype).join(', ') || 'Not specified'}
                    </td>
                    <td className="px-4 py-3">{formatInr(c.monthlyFee)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {OPS_CLIENT_STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">{c.teamNames ?? '—'}</td>
                    <td className="px-4 py-3">{c.workStatus ?? 'Not started'}</td>
                    <td className="px-4 py-3">{c.escalation ?? 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.clients.length === 0 ? (
              <p className="text-muted-foreground p-6 text-center text-sm">
                No clients with {OPS_SERVICE_CATEGORY_LABEL[category]} yet.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MiniKpi({
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
    <div className="border-border bg-surface rounded-xl border px-3 py-3">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-orange-500' : ''
        }`}
      >
        {value}
      </p>
      {sub ? <p className="text-muted-foreground text-[11px]">{sub}</p> : null}
    </div>
  );
}
