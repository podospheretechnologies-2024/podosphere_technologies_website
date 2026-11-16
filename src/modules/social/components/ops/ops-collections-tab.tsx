'use client';

import { useMemo, useState } from 'react';
import { monthLabel } from '@/modules/social/server/ops/ops.constants';
import { formatInr, opsCall, useOpsPayments, type OpsPayment } from './ops-api';

const BUCKETS = [
  { key: 'overdue', label: 'Overdue', dot: 'bg-red-500', empty: 'Nothing here' },
  { key: 'next_7', label: 'Due in next 7 days', dot: 'bg-orange-500', empty: 'Nothing here' },
  { key: 'later', label: 'Due later', dot: 'bg-blue-500', empty: 'Nothing here' },
  { key: 'no_due_date', label: 'No due date', dot: 'bg-gray-400', empty: 'Nothing here' },
  {
    key: 'paid',
    label: 'Paid',
    dot: 'bg-emerald-500',
    empty: 'Drag a payment here to mark it paid',
  },
] as const;

type BucketKey = (typeof BUCKETS)[number]['key'];

export function OpsCollectionsTab({ monthKey }: { monthKey: string }) {
  const { data: payments = [], error, isLoading, mutate } = useOpsPayments(monthKey);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const kpis = useMemo(() => {
    const unpaidMonth = payments.filter((p) => !p.paidAt && p.monthKey === monthKey);
    const paidMonth = payments.filter((p) => p.paidAt && p.monthKey === monthKey);
    const overdue = payments.filter((p) => p.bucket === 'overdue');
    const toCollect = unpaidMonth.reduce((s, p) => s + (p.amount ?? 0), 0);
    const collected = paidMonth.reduce((s, p) => s + (p.amount ?? 0), 0);
    return {
      toCollect,
      collected,
      still: Math.max(0, toCollect),
      overdue: overdue.reduce((s, p) => s + (p.amount ?? 0), 0),
    };
  }, [payments, monthKey]);

  const byBucket = useMemo(() => {
    const map: Record<BucketKey, OpsPayment[]> = {
      overdue: [],
      next_7: [],
      later: [],
      no_due_date: [],
      paid: [],
    };
    for (const p of payments) {
      if (p.bucket === 'paid' && p.monthKey !== monthKey) continue;
      map[p.bucket].push(p);
    }
    return map;
  }, [payments, monthKey]);

  async function markPaid(payment: OpsPayment) {
    await opsCall(`/payments/${payment.id}`, 'PATCH', { markPaid: true });
    await mutate();
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading collections…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={`To collect in ${monthLabel(monthKey)}`} value={formatInr(kpis.toCollect)} tone="blue" />
          <Stat label={`Collected in ${monthLabel(monthKey)}`} value={formatInr(kpis.collected)} tone="green" />
          <Stat label="Still to collect this month" value={formatInr(kpis.still)} tone="orange" />
          <Stat label="Overdue, all months" value={formatInr(kpis.overdue)} tone="red" />
        </div>
        <div className="border-border flex rounded-lg border p-0.5 text-sm">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${view === 'kanban' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setView('kanban')}
          >
            Kanban
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${view === 'list' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setView('list')}
          >
            List by date
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {BUCKETS.map((bucket) => {
            const items = byBucket[bucket.key];
            const label =
              bucket.key === 'paid' ? `Paid — ${monthLabel(monthKey)}` : bucket.label;
            return (
              <div
                key={bucket.key}
                className="border-border bg-surface-muted/40 flex w-72 shrink-0 flex-col rounded-xl border"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className={`size-2 rounded-full ${bucket.dot}`} />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-muted-foreground text-xs">({items.length})</span>
                </div>
                <div className="flex flex-col gap-2 px-2 pb-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {items.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-8 text-center text-xs">{bucket.empty}</p>
                  ) : (
                    items.map((p) => (
                      <PaymentCard key={p.id} payment={p} onMarkPaid={() => markPaid(p)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-muted/50 text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {[...payments]
                .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
                .map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.clientName}</td>
                    <td className="px-4 py-3">{formatInr(p.amount)}</td>
                    <td className="px-4 py-3">{p.dueDate ?? '—'}</td>
                    <td className="px-4 py-3 capitalize">{p.bucket.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right">
                      {!p.paidAt ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-emerald-600"
                          onClick={() => markPaid(p)}
                        >
                          Mark paid
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentCard({
  payment,
  onMarkPaid,
}: {
  payment: OpsPayment;
  onMarkPaid: () => void;
}) {
  return (
    <div className="border-border bg-surface rounded-xl border p-3 shadow-sm">
      <p className="font-semibold">{payment.clientName}</p>
      <p className="mt-1 text-base font-bold tabular-nums">
        {payment.amount != null ? formatInr(payment.amount) : 'Amount not set'}
      </p>
      {payment.description ? (
        <p className="text-muted-foreground mt-1 text-xs">{payment.description}</p>
      ) : null}
      <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        {payment.paidAt
          ? 'Paid'
          : payment.dueDate
            ? payment.bucket === 'overdue'
              ? 'Overdue'
              : `Due ${payment.dueDate}`
            : 'No due date'}
      </span>
      {!payment.paidAt ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onMarkPaid}
            className="text-sm font-medium text-emerald-600"
          >
            Mark paid
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'orange' | 'red';
}) {
  const color = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    orange: 'text-orange-500',
    red: 'text-red-600',
  }[tone];
  return (
    <div className="border-border bg-surface rounded-xl border px-3 py-3">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
