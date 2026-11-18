'use client';

import { useMemo, useState } from 'react';
import { useOrderFlowResults } from '../../hooks/use-order-flows';
import { dayEndIso, dayStartIso } from '../../lib/order-flow.client';

const fieldClass = 'border-border bg-background h-10 rounded-lg border px-3 text-sm';

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number | null | undefined): string {
  if (value == null) return '–';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function OrderFlowResults() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const query = useMemo(
    () => ({ from: dayStartIso(from), to: dayEndIso(to) }),
    [from, to]
  );
  const { data, error, isLoading } = useOrderFlowResults(query);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Results</h2>
          <p className="text-muted-foreground text-sm">
            A cart counts as recovered when the same customer orders within 7 days of a reminder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="results-from">
            From date
          </label>
          <input
            id="results-from"
            type="date"
            className={fieldClass}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <label className="sr-only" htmlFor="results-to">
            To date
          </label>
          <input
            id="results-to"
            type="date"
            className={fieldClass}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      {error && !data ? (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load results'}
        </p>
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading results…</p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">No results yet.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Messages sent" value={data.messagesSent.toLocaleString('en-IN')} />
            <Kpi label="Carts recovered" value={data.cartsRecovered.toLocaleString('en-IN')} />
            <Kpi label="Revenue recovered" value={money(data.revenueRecovered)} />
            <Kpi
              label="Money spent on messages (estimate)"
              value={money(data.estimatedMessageCost)}
            />
          </div>

          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="bg-surface-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 font-medium">Flow</th>
                  <th className="px-3 py-2 font-medium">Sent</th>
                  <th className="px-3 py-2 font-medium">Recovered</th>
                  <th className="px-3 py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.byFlow.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground px-3 py-4">
                      No per-flow data in this range.
                    </td>
                  </tr>
                ) : (
                  data.byFlow.map((row) => (
                    <tr key={row.flowKey} className="border-border border-t">
                      <td className="px-3 py-2 font-medium">{row.label}</td>
                      <td className="px-3 py-2">{row.sent.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2">
                        {row.recovered > 0 ? row.recovered.toLocaleString('en-IN') : '–'}
                      </td>
                      <td className="px-3 py-2">
                        {row.revenue > 0 ? money(row.revenue) : '–'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
