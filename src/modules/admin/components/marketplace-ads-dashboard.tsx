'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Store } from 'lucide-react';
import {
  MARKETPLACE_META,
  MARKETPLACES,
  type MarketplaceCampaign,
  type MarketplaceClientOption,
  type MarketplaceId,
  type MarketplaceSnapshot,
  snapshotFor,
} from '../data/marketplace-ads.sample';

type TabId = MarketplaceId | 'all';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrExact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatMoney(value: number) {
  return value >= 1000 ? inr.format(value) : inrExact.format(value);
}

function statusClass(status: MarketplaceCampaign['status']) {
  if (status === 'LIVE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'LEARNING') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const width = 140;
  const height = 36;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / max) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-32 text-indigo-500" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

function sumSnapshots(snapshots: MarketplaceSnapshot[]): MarketplaceSnapshot {
  const campaigns = snapshots.flatMap((item) => item.campaigns);
  const spend = snapshots.reduce((sum, item) => sum + item.kpis.spend, 0);
  const revenue = snapshots.reduce((sum, item) => sum + item.kpis.revenue, 0);
  return {
    wallet: snapshots.reduce((sum, item) => sum + item.wallet, 0),
    kpis: {
      spend,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      impressions: snapshots.reduce((sum, item) => sum + item.kpis.impressions, 0),
      clicks: snapshots.reduce((sum, item) => sum + item.kpis.clicks, 0),
      orders: snapshots.reduce((sum, item) => sum + item.kpis.orders, 0),
    },
    extras: [
      { label: 'Marketplaces', value: String(snapshots.length) },
      { label: 'Campaigns', value: String(campaigns.length) },
      { label: 'Live', value: String(campaigns.filter((row) => row.status === 'LIVE').length) },
    ],
    trend: snapshots[0]?.trend ?? [],
    campaigns,
  };
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function CampaignTable({
  rows,
  showMarketplace,
}: {
  rows: Array<MarketplaceCampaign & { marketplace?: MarketplaceId }>;
  showMarketplace: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {showMarketplace ? (
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Marketplace
              </th>
            ) : null}
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Campaign
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Budget
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Spend
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Views
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Clicks
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Orders
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Revenue
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              ROAS
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="align-top hover:bg-gray-50/80">
              {showMarketplace && row.marketplace ? (
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${MARKETPLACE_META[row.marketplace].pill}`}
                  >
                    {MARKETPLACE_META[row.marketplace].label}
                  </span>
                </td>
              ) : null}
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{row.name}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {row.type} · {row.duration}
                </div>
                {row.action ? <div className="mt-1 text-xs text-red-600">{row.action}</div> : null}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(row.status)}`}
                >
                  {row.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-600">{row.budgetLabel}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900">{formatMoney(row.spend)}</td>
              <td className="px-4 py-3 text-right text-gray-600">{compact.format(row.impressions)}</td>
              <td className="px-4 py-3 text-right text-gray-600">{compact.format(row.clicks)}</td>
              <td className="px-4 py-3 text-right text-gray-600">{row.orders}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900">{formatMoney(row.revenue)}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">{row.roas.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketplaceAdsDashboard({ clients }: { clients: MarketplaceClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [tab, setTab] = useState<TabId>('all');
  const slot = Math.max(
    clients.findIndex((client) => client.id === clientId),
    0,
  );
  const client = clients[slot];

  const view = useMemo(() => {
    if (tab === 'all') {
      const snapshots = MARKETPLACES.map((marketplace) => snapshotFor(slot, marketplace));
      const combined = sumSnapshots(snapshots);
      const rows = MARKETPLACES.flatMap((marketplace) =>
        snapshotFor(slot, marketplace).campaigns.map((campaign) => ({ ...campaign, marketplace })),
      );
      return { snapshot: combined, rows, showMarketplace: true };
    }
    const snapshot = snapshotFor(slot, tab);
    return {
      snapshot,
      rows: snapshot.campaigns.map((campaign) => ({ ...campaign, marketplace: tab })),
      showMarketplace: false,
    };
  }, [slot, tab]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="size-4" />
            Super Admin
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Marketplace ads</h1>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Sample data
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Blinkit, Meesho, Flipkart, and Amazon for three clients from Client Management. Numbers
            are demo-only.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Range</div>
          <div className="font-medium text-gray-900">1 Sep 2026 → 19 Oct 2026</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {clients.map((item) => {
          const active = item.id === clientId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setClientId(item.id)}
              className={`rounded-xl border p-4 text-left shadow-sm transition ${
                active
                  ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                {item.isDemo ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                    Demo name
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-gray-500">{item.organizationName}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
            tab === 'all'
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Store className="size-3.5" />
          All marketplaces
        </button>
        {MARKETPLACES.map((marketplace) => (
          <button
            key={marketplace}
            type="button"
            onClick={() => setTab(marketplace)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              tab === marketplace
                ? `${MARKETPLACE_META[marketplace].pill} ring-1 ring-offset-1`
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {MARKETPLACE_META[marketplace].label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {client?.name}
            {tab === 'all' ? ' · all marketplaces' : ` · ${MARKETPLACE_META[tab].label}`}
          </h2>
          <p className="text-sm text-gray-500">
            Wallet {formatMoney(view.snapshot.wallet)}
            {tab !== 'all' ? ` · ${MARKETPLACE_META[tab].label} seller ads` : null}
          </p>
        </div>
        <Sparkline values={view.snapshot.trend} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Ad spend" value={formatMoney(view.snapshot.kpis.spend)} />
        <Kpi label="Revenue" value={formatMoney(view.snapshot.kpis.revenue)} />
        <Kpi label="ROAS" value={view.snapshot.kpis.roas.toFixed(2)} />
        <Kpi label="Views" value={compact.format(view.snapshot.kpis.impressions)} />
        <Kpi label="Clicks" value={compact.format(view.snapshot.kpis.clicks)} />
        <Kpi label="Orders" value={String(view.snapshot.kpis.orders)} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {view.snapshot.extras.map((extra) => (
          <span
            key={extra.label}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600"
          >
            <span className="text-gray-400">{extra.label}:</span>{' '}
            <span className="font-medium text-gray-900">{extra.value}</span>
          </span>
        ))}
      </div>

      <CampaignTable rows={view.rows} showMarketplace={view.showMarketplace} />
    </div>
  );
}
