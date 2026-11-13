'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { count, money, pct, times, type CampaignRow, type Overview } from './growth-api';
import { DualChart, Empty, ErrorLine, Panel, Pill } from './growth-ui';

function CampaignTable({
  rows,
  currency,
  target,
  mode,
}: {
  rows: CampaignRow[];
  currency: string;
  target: number;
  mode: 'meta' | 'google';
}) {
  const T = rows.reduce(
    (a, r) => ({ spend: a.spend + r.spend, purchases: a.purchases + r.purchases, revenue: a.revenue + r.revenue, atc: a.atc + r.atc }),
    { spend: 0, purchases: 0, revenue: 0, atc: 0 }
  );
  const headers =
    mode === 'meta'
      ? ['Campaign', 'Status', 'Spend', 'Purchases', 'Revenue', 'ROAS', 'Cost / purchase', 'CTR', 'Add to cart']
      : ['Campaign', 'Status', 'Spend', 'Conversions', 'Cost / conv.', 'CTR'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-muted-foreground text-xs">
          <tr className="border-border border-b">
            {headers.map((h, i) => (
              <th key={h} className={cn('px-2 py-2 font-medium', i === 0 ? 'text-left' : 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-border border-b">
              <td className="max-w-80 min-w-48 px-2 py-2 break-words">{r.name}</td>
              <td className="px-2 py-2 text-right">
                <Pill tone={r.status === 'ACTIVE' ? 'good' : 'muted'}>{r.status === 'ACTIVE' ? 'Active' : r.status.toLowerCase()}</Pill>
              </td>
              <td className="px-2 py-2 text-right">{money(r.spend, currency)}</td>
              <td className="px-2 py-2 text-right">{count(r.purchases)}</td>
              {mode === 'meta' && (
                <>
                  <td className="px-2 py-2 text-right">{money(r.revenue, currency)}</td>
                  <td
                    className={cn(
                      'px-2 py-2 text-right font-semibold',
                      r.roas == null ? '' : r.roas >= target ? 'text-success' : r.roas >= 3 ? 'text-amber-600' : 'text-danger'
                    )}
                  >
                    {times(r.roas)}
                  </td>
                </>
              )}
              <td className="px-2 py-2 text-right">{money(r.costPerPurchase, currency)}</td>
              <td className="px-2 py-2 text-right">{r.ctr == null ? '–' : `${(r.ctr * 100).toFixed(2)}%`}</td>
              {mode === 'meta' && <td className="px-2 py-2 text-right">{count(r.atc)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="px-2 py-2">Total</td>
            <td />
            <td className="px-2 py-2 text-right">{money(T.spend, currency)}</td>
            <td className="px-2 py-2 text-right">{count(T.purchases)}</td>
            {mode === 'meta' && (
              <>
                <td className="px-2 py-2 text-right">{money(T.revenue, currency)}</td>
                <td className="px-2 py-2 text-right">{times(T.spend ? T.revenue / T.spend : null)}</td>
              </>
            )}
            <td className="px-2 py-2 text-right">{money(T.purchases ? T.spend / T.purchases : null, currency)}</td>
            <td />
            {mode === 'meta' && <td className="px-2 py-2 text-right">{count(T.atc)}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function PerformanceTab({ data }: { data: Overview }) {
  const [filter, setFilter] = useState<'active' | 'sales' | 'all'>('active');
  const currency = data.store.currency ?? 'INR';
  const target = data.settings.targetRoas;
  let rows = data.campaigns;
  if (filter === 'active') rows = rows.filter((r) => r.status === 'ACTIVE');
  if (filter === 'sales') rows = rows.filter((r) => /SALES|CONVERSIONS|PRODUCT_CATALOG/i.test(r.objective ?? ''));
  let googleRows = data.googleCampaigns ?? [];
  if (filter === 'active') googleRows = googleRows.filter((r) => r.status === 'ACTIVE');
  if (filter === 'sales') googleRows = googleRows.filter((r) => /SEARCH|SHOPPING|PERFORMANCE_MAX|DEMAND_GEN|DISPLAY/i.test(r.objective ?? ''));
  const labels = data.days.map((d) => d.date);
  const spendLabel = data.hasGoogleAds && data.hasMetaAds ? 'Ad spend' : data.hasGoogleAds ? 'Google spend' : 'Meta spend';

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Meta campaign results"
        action={
          <div className="flex gap-1">
            {(['active', 'sales', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn('rounded-full px-3 py-0.5 text-xs', filter === f ? 'bg-primary text-primary-foreground' : 'border-border border')}
              >
                {f === 'active' ? 'Active' : f === 'sales' ? 'Sales campaigns' : 'All'}
              </button>
            ))}
          </div>
        }
      >
        <p className="text-muted-foreground text-xs">
          {data.range.label} · revenue and purchases are Meta-reported (pixel). ROAS colour: green at or above {target}x, amber 3x+, red below.
        </p>
        {!data.hasMetaAds && <Empty>No Meta ad account is assigned to this client. Assign one on the Ads page.</Empty>}
        {data.hasMetaAds && !rows.length && <Empty>No Meta campaigns with spend match this filter for these dates.</Empty>}
        {rows.length > 0 && <CampaignTable rows={rows} currency={currency} target={target} mode="meta" />}
      </Panel>

      {(data.hasGoogleAds || data.googleError) && (
        <Panel title="Google Ads campaigns">
          <p className="text-muted-foreground text-xs">
            {data.range.label} · live from Google Ads for this client. Conversions use the account&apos;s conversion actions.
          </p>
          <ErrorLine error={data.googleError} />
          {!data.googleError && !googleRows.length && <Empty>No Google campaigns with spend match this filter for these dates.</Empty>}
          {!data.googleError && googleRows.length > 0 && (
            <CampaignTable rows={googleRows} currency={currency} target={target} mode="google" />
          )}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Sales vs ad spend, daily (${currency})`}>
          <DualChart labels={labels} bars={data.days.map((d) => d.sales)} line={data.days.map((d) => d.spend)} barLabel="Shopify sales" lineLabel={spendLabel} />
        </Panel>
        <Panel title="Traffic, daily">
          <DualChart
            labels={labels}
            bars={data.days.map((d) => d.sessions)}
            line={data.days.map((d) => d.atc)}
            barLabel="Sessions"
            lineLabel="Add to cart"
            lineOnly
          />
          {data.store.connected && data.store.trafficAvailable === false && (
            <p className="text-muted-foreground text-xs">Sessions are not available from this store yet: {data.store.trafficError}</p>
          )}
        </Panel>
      </div>

      <Panel title="Day by day">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-muted-foreground text-xs">
              <tr className="border-border border-b">
                {['Date', 'Orders', 'Sales', 'Ad spend', 'ROAS', 'Meta purchases', 'Sessions', 'Add to cart', 'Order rate'].map((h, i) => (
                  <th key={h} className={cn('px-2 py-2 font-medium', i === 0 ? 'text-left' : 'text-right')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.days].reverse().map((d) => (
                <tr key={d.date} className="border-border border-b">
                  <td className="px-2 py-1.5">{d.date}</td>
                  <td className="px-2 py-1.5 text-right">{count(d.orders)}</td>
                  <td className="px-2 py-1.5 text-right">{money(d.sales, currency)}</td>
                  <td className="px-2 py-1.5 text-right">{money(d.spend, currency)}</td>
                  <td className="px-2 py-1.5 text-right">{times(d.spend && d.sales != null ? d.sales / d.spend : null)}</td>
                  <td className="px-2 py-1.5 text-right">{count(d.metaPurchases)}</td>
                  <td className="px-2 py-1.5 text-right">{count(d.sessions)}</td>
                  <td className="px-2 py-1.5 text-right">{count(d.atc)}</td>
                  <td className="px-2 py-1.5 text-right">{pct(d.orders, d.sessions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
