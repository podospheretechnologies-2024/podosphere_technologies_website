'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import type { OrderFlowKey } from '../../config/order-flows';
import { patchOrderFlow } from '../../lib/order-flow.client';
import type { OrderFlowListItem, OrderFlowListResponse } from '../../types/order-flow';

function formatMoney(value: number | null | undefined): string {
  if (value == null || value === 0) return '–';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatDelay(row: OrderFlowListItem): string {
  if (row.delayValue == null || !row.delayUnit) return 'Immediately';
  const unit = row.delayValue === 1 ? row.delayUnit.replace(/s$/, '') : row.delayUnit;
  return `after ${row.delayValue} ${unit}`;
}

function deliveredPct(row: OrderFlowListItem): string {
  if (row.sent30d <= 0) return '–';
  return `${Math.round((row.delivered30d / row.sent30d) * 100)}%`;
}

function isWebhookStale(lastWebhookAt: string | null): boolean {
  if (!lastWebhookAt) return false;
  const age = Date.now() - new Date(lastWebhookAt).getTime();
  return age > 48 * 60 * 60 * 1000;
}

function ToggleSwitch({
  on,
  disabled,
  onToggle,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.();
      }}
      className={cn(
        'relative inline-flex h-[18px] w-[34px] shrink-0 items-center rounded-full transition',
        on ? 'bg-foreground' : 'bg-border',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span
        className={cn(
          'absolute size-3.5 rounded-full bg-white shadow transition',
          on ? 'left-[16px]' : 'left-[2px]'
        )}
      />
    </button>
  );
}

function WarningBanners({
  data,
  numberConnected,
  phoneDisplay,
}: {
  data: OrderFlowListResponse;
  numberConnected: boolean;
  phoneDisplay: string | null;
}) {
  const { store } = data;
  const banners: ReactNode[] = [];

  if (!store.connected) {
    banners.push(
      <>
        Connect Shopify on Growth to send order messages.{' '}
        <Link href="/dashboard/social/growth" className="underline underline-offset-2">
          Open Growth
        </Link>
      </>
    );
  }
  if (!numberConnected) {
    banners.push(<>Connect a WhatsApp number before turning flows on.</>);
  }
  if (store.connected && !store.webhooksEnabled) {
    banners.push(<>Shopify is connected but order events are not enabled yet.</>);
  }
  if (store.connected && store.webhooksEnabled && isWebhookStale(store.lastWebhookAt)) {
    banners.push(
      <>
        Shopify may have stopped sending events
        {store.lastWebhookAt
          ? ` (last event ${new Date(store.lastWebhookAt).toLocaleString('en-IN')})`
          : ''}
        .
      </>
    );
  }
  if (store.orderFlowsPaused) {
    banners.push(
      <>
        {store.orderFlowsPausedReason ??
          'Order flows are paused after repeated send failures. Fix the issue, then turn a flow back on.'}
      </>
    );
  }

  if (banners.length === 0 && !phoneDisplay) return null;
  if (banners.length === 0) return null;

  return (
    <div className="space-y-2">
      {banners.map((text, index) => (
        <div
          key={index}
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {text}
        </div>
      ))}
    </div>
  );
}

function FlowRowView({
  row,
  busy,
  onEdit,
  onToggle,
}: {
  row: OrderFlowListItem;
  busy: boolean;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const hasTemplate = Boolean(row.templateName && row.templateLanguage);
  const recover = row.group === 'recover_sales';

  return (
    <div className="border-border flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0">
      <ToggleSwitch
        on={row.enabled}
        disabled={!hasTemplate || busy}
        label={`${row.enabled ? 'Disable' : 'Enable'} ${row.label}`}
        onToggle={() => onToggle(!row.enabled)}
      />
      <div className="min-w-[12rem] flex-1">
        <p className="text-sm font-medium">{row.label}</p>
        <p className="text-muted-foreground text-xs">
          {hasTemplate ? `${row.templateName} · ${formatDelay(row)}` : 'Choose a template'}
        </p>
      </div>
      <div className="text-muted-foreground grid min-w-[10rem] grid-cols-2 gap-x-4 gap-y-1 text-right text-xs sm:grid-cols-3">
        <div>
          <p className="uppercase tracking-wide">Sent 30d</p>
          <p className="text-foreground text-sm font-medium">
            {row.sent30d > 0 ? row.sent30d.toLocaleString('en-IN') : '–'}
          </p>
        </div>
        {recover ? (
          <>
            <div>
              <p className="uppercase tracking-wide">Recovered</p>
              <p className="text-foreground text-sm font-medium">
                {row.recovered30d > 0 ? row.recovered30d.toLocaleString('en-IN') : '–'}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wide">Revenue</p>
              <p className="text-foreground text-sm font-medium">{formatMoney(row.revenue30d)}</p>
            </div>
          </>
        ) : (
          <div>
            <p className="uppercase tracking-wide">Delivered</p>
            <p className="text-foreground text-sm font-medium">{deliveredPct(row)}</p>
          </div>
        )}
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

function GroupSection({
  title,
  rows,
  busyKey,
  onEdit,
  onToggle,
}: {
  title: string;
  rows: OrderFlowListItem[];
  busyKey: OrderFlowKey | null;
  onEdit: (key: OrderFlowKey) => void;
  onToggle: (key: OrderFlowKey, enabled: boolean) => void;
}) {
  return (
    <section className="border-border rounded-lg border">
      <div className="border-border bg-surface-muted/40 border-b px-4 py-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
          {title}
        </h3>
      </div>
      <div className="px-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">No flows in this group.</p>
        ) : (
          rows.map((row) => (
            <FlowRowView
              key={row.flowKey}
              row={row}
              busy={busyKey === row.flowKey}
              onEdit={() => onEdit(row.flowKey)}
              onToggle={(enabled) => onToggle(row.flowKey, enabled)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function OrderFlowList({
  data,
  numberConnected,
  phoneDisplay,
  onEdit,
  onMutate,
}: {
  data: OrderFlowListResponse;
  numberConnected: boolean;
  phoneDisplay: string | null;
  onEdit: (key: OrderFlowKey) => void;
  onMutate: () => Promise<unknown>;
}) {
  const [busyKey, setBusyKey] = useState<OrderFlowKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orderUpdates = data.flows.filter((f) => f.group === 'order_updates');
  const recoverSales = data.flows.filter((f) => f.group === 'recover_sales');

  async function toggle(key: OrderFlowKey, enabled: boolean) {
    setError(null);
    setBusyKey(key);
    try {
      await patchOrderFlow(key, { enabled });
      await onMutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update flow');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">
            Order flows
            {data.store.shopName ? (
              <span className="text-muted-foreground font-normal"> · {data.store.shopName}</span>
            ) : null}
          </h2>
          <p className="text-muted-foreground text-sm">
            Store:{' '}
            <span className={data.store.connected ? 'text-foreground' : ''}>
              {data.store.connected ? 'connected' : 'not connected'}
            </span>
            {' · '}
            Number:{' '}
            <span className={numberConnected ? 'text-foreground' : ''}>
              {phoneDisplay ?? (numberConnected ? 'connected' : 'not connected')}
            </span>
          </p>
        </div>
      </div>

      <WarningBanners
        data={data}
        numberConnected={numberConnected}
        phoneDisplay={phoneDisplay}
      />

      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {error}
        </div>
      )}

      <GroupSection
        title="Order updates"
        rows={orderUpdates}
        busyKey={busyKey}
        onEdit={onEdit}
        onToggle={toggle}
      />
      <GroupSection
        title="Recover sales"
        rows={recoverSales}
        busyKey={busyKey}
        onEdit={onEdit}
        onToggle={toggle}
      />
    </div>
  );
}
