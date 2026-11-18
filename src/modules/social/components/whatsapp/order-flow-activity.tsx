'use client';

import { useMemo, useState } from 'react';
import { ORDER_FLOW_DEFINITIONS, type OrderFlowKey } from '../../config/order-flows';
import { useOrderFlowActivity } from '../../hooks/use-order-flows';
import { dayEndIso, dayStartIso } from '../../lib/order-flow.client';
import type { OrderFlowMessageStatus } from '../../types/order-flow';

const fieldClass = 'border-border bg-background h-10 rounded-lg border px-3 text-sm';

const STATUSES: { value: OrderFlowMessageStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'read', label: 'Read' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'skipped', label: 'Skipped' },
];

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function OrderFlowActivity() {
  const [flowKey, setFlowKey] = useState<OrderFlowKey | ''>('');
  const [status, setStatus] = useState<OrderFlowMessageStatus | ''>('');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const query = useMemo(
    () => ({
      flowKey: flowKey || undefined,
      status: status || undefined,
      from: dayStartIso(from),
      to: dayEndIso(to),
    }),
    [flowKey, status, from, to]
  );

  const { data, error, isLoading } = useOrderFlowActivity(query);
  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Activity</h2>
        <p className="text-muted-foreground text-sm">
          Every order-flow message, newest first. Failed and skipped rows show why.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="activity-flow">
          Flow
        </label>
        <select
          id="activity-flow"
          className={fieldClass}
          value={flowKey}
          onChange={(event) => setFlowKey(event.target.value as OrderFlowKey | '')}
        >
          <option value="">All flows</option>
          {ORDER_FLOW_DEFINITIONS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="activity-status">
          Status
        </label>
        <select
          id="activity-status"
          className={fieldClass}
          value={status}
          onChange={(event) => setStatus(event.target.value as OrderFlowMessageStatus | '')}
        >
          {STATUSES.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="activity-from">
          From date
        </label>
        <input
          id="activity-from"
          type="date"
          className={fieldClass}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <label className="sr-only" htmlFor="activity-to">
          To date
        </label>
        <input
          id="activity-to"
          type="date"
          className={fieldClass}
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>

      {error && !data ? (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load activity'}
        </p>
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading activity…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No messages in this range yet.</p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Flow</th>
                <th className="px-3 py-2 font-medium">Order / cart</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-border border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatTime(row.sentAt ?? row.createdAt)}
                  </td>
                  <td className="px-3 py-2">{row.customerName || row.phone || '–'}</td>
                  <td className="px-3 py-2">{row.flowLabel}</td>
                  <td className="px-3 py-2">
                    {row.orderLabel ||
                      (row.cartTotal != null
                        ? `${row.currency ?? '₹'}${Math.round(row.cartTotal).toLocaleString('en-IN')}`
                        : '–')}
                  </td>
                  <td className="px-3 py-2 capitalize">
                    {row.status}
                    {row.statusReason ? (
                      <span className="text-muted-foreground block text-xs normal-case">
                        {row.statusReason}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.resultLabel || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.total > rows.length ? (
            <p className="text-muted-foreground border-border border-t px-3 py-2 text-xs">
              Showing {rows.length} of {data.total}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
