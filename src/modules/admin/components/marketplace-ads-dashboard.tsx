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
  clientCount,
  marketplaceClientsFor,
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
  if (status === 'DRAFT') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'ENDED') return 'bg-slate-100 text-slate-500 border-slate-200';
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
      { label: 'Platforms', value: String(snapshots.length) },
      { label: 'Campaigns', value: String(campaigns.length) },
      { label: 'Live', value: String(campaigns.filter((row) => row.status === 'LIVE').length) },
    ],
    trend: snapshots[0]?.trend ?? [],
    campaigns,
  };
}

function slotsFor(marketplace: MarketplaceId) {
  return Array.from({ length: clientCount(marketplace) }, (_, index) => index);
}

/** Every client of one platform, summed. */
function platformTotals(marketplace: MarketplaceId): MarketplaceSnapshot {
  return sumSnapshots(slotsFor(marketplace).map((slot) => snapshotFor(slot, marketplace)));
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function statusLabel(status: MarketplaceCampaign['status']) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function meeshoStatusLabel(status: MarketplaceCampaign['status']) {
  if (status === 'LIVE') return 'Live';
  if (status === 'LEARNING') return 'Learning';
  if (status === 'DRAFT') return 'Draft';
  if (status === 'ENDED') return 'Ended';
  return 'Paused';
}

function MeeshoAdsView({
  clientName,
  snapshot,
}: {
  clientName: string;
  snapshot: MarketplaceSnapshot;
}) {
  const live = snapshot.campaigns.filter((row) => row.status === 'LIVE').length;
  return (
    <div className="overflow-hidden rounded-2xl border border-pink-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F43397] px-5 py-4 text-white">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-pink-100">
            Supplier Hub · Ads
          </div>
          <h2 className="text-lg font-semibold">{clientName} · Meesho Ads</h2>
        </div>
        <div className="text-right text-sm text-pink-100">
          <div>Ads wallet {formatMoney(snapshot.wallet)}</div>
          <div className="text-xs">{live} live catalog campaigns</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-pink-100 bg-pink-50 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Ad spend" value={formatMoney(snapshot.kpis.spend)} />
        <Kpi label="Sales" value={formatMoney(snapshot.kpis.revenue)} />
        <Kpi label="ROI" value={snapshot.kpis.roas.toFixed(2)} />
        <Kpi label="Views" value={compact.format(snapshot.kpis.impressions)} />
        <Kpi label="Clicks" value={compact.format(snapshot.kpis.clicks)} />
        <Kpi label="Orders" value={String(snapshot.kpis.orders)} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-white px-4 py-3">
        {snapshot.extras.map((extra) => (
          <span
            key={extra.label}
            className="rounded-full border border-pink-100 bg-pink-50 px-3 py-1 text-xs font-medium text-pink-800"
          >
            {extra.label}: {extra.value}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-[#FFF5F9]">
            <tr>
              {[
                'Campaign',
                'Catalogs',
                'Status',
                'Duration',
                'Budget',
                'Spend',
                'Views',
                'Clicks',
                'Orders',
                'Sales',
                'ROI',
              ].map((label, index) => (
                <th
                  key={label}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-pink-900 ${
                    index >= 5 ? 'text-right' : 'text-left'
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {snapshot.campaigns.map((row) => (
              <tr key={row.id} className="align-top hover:bg-pink-50/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{row.name}</div>
                  {row.action ? <div className="mt-1 text-xs text-red-600">{row.action}</div> : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{row.type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(row.status)}`}
                  >
                    {meeshoStatusLabel(row.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{row.duration}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{row.budgetLabel}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900">
                  {formatMoney(row.spend)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{compact.format(row.impressions)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{compact.format(row.clicks)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.orders}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900">
                  {formatMoney(row.revenue)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{row.roas.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                  {statusLabel(row.status)}
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

export function MarketplaceAdsDashboard({ clients: accounts }: { clients: MarketplaceClientOption[] }) {
  const [tab, setTab] = useState<TabId>('meesho');
  const [slot, setSlot] = useState(0);
  const clients = useMemo(() => (tab === 'all' ? [] : marketplaceClientsFor(tab, accounts)), [tab, accounts]);
  const client = clients[slot];

  const view = useMemo(() => {
    if (tab === 'all') {
      const snapshots = MARKETPLACES.flatMap((marketplace) =>
        slotsFor(marketplace).map((index) => ({ marketplace, snapshot: snapshotFor(index, marketplace) })),
      );
      const combined = sumSnapshots(snapshots.map((item) => item.snapshot));
      const rows = snapshots.flatMap(({ marketplace, snapshot }) =>
        snapshot.campaigns.map((campaign) => ({ ...campaign, marketplace })),
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

  function selectTab(next: TabId) {
    setTab(next);
    setSlot(0);
  }

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
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Meta Ads, Google Ads, Blinkit, Meesho, Flipkart, and Amazon for Kabira Its Handmade, Siyara Beauty, and Himshakti.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Range</div>
          <div className="font-medium text-gray-900">1 Sep 2026 → 19 Oct 2026</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {clients.map((item, index) => {
          const active = index === slot;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSlot(index)}
              className={`rounded-xl border p-4 text-left shadow-sm transition ${
                active
                  ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">{item.name}</div>
              </div>
              <div className="mt-1 text-xs text-gray-500">{item.organizationName}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectTab('all')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
            tab === 'all'
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Store className="size-3.5" />
          All platforms
        </button>
        {MARKETPLACES.map((marketplace) => (
          <button
            key={marketplace}
            type="button"
            onClick={() => selectTab(marketplace)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              tab === marketplace
                ? `${MARKETPLACE_META[marketplace].pill} ring-1 ring-offset-1`
                : marketplace === 'meesho'
                  ? 'border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {MARKETPLACE_META[marketplace].label}
          </button>
        ))}
      </div>

      {tab === 'meesho' ? (
        <MeeshoAdsView clientName={client?.name ?? 'Client'} snapshot={view.snapshot} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {tab === 'all' ? 'All clients' : client?.name}
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
        </>
      )}
    </div>
  );
}

/** Single-platform view, embedded in the workspace Ads page (platform admins only). */
export function MarketplaceSamplePanel({
  marketplace,
  clients,
}: {
  marketplace: Exclude<MarketplaceId, 'meta'>;
  clients: MarketplaceClientOption[];
}) {
  const [pickedId, setClientId] = useState(clients[0]?.id ?? '');
  const clientId = clients.some((item) => item.id === pickedId) ? pickedId : (clients[0]?.id ?? '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MarketplaceCampaign['status']>('ALL');
  const slot = Math.max(
    clients.findIndex((client) => client.id === clientId),
    0,
  );
  const client = clients[slot];
  const full = snapshotFor(slot, marketplace);
  const statusCounts = full.campaigns.reduce<Partial<Record<MarketplaceCampaign['status'], number>>>(
    (counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }),
    {},
  );
  const activeFilter = statusFilter !== 'ALL' && statusCounts[statusFilter] ? statusFilter : 'ALL';
  const snapshot = {
    ...full,
    campaigns: activeFilter === 'ALL' ? full.campaigns : full.campaigns.filter((row) => row.status === activeFilter),
  };
  const rows = snapshot.campaigns.map((campaign) => ({ ...campaign, marketplace }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {clients.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setClientId(item.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              item.id === clientId
                ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['ALL', 'LIVE', 'LEARNING', 'PAUSED', 'DRAFT', 'ENDED'] as const)
          .filter((status) => status === 'ALL' || statusCounts[status])
          .map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                activeFilter === status
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status === 'ALL' ? 'All' : statusLabel(status)} (
              {status === 'ALL' ? full.campaigns.length : statusCounts[status]})
            </button>
          ))}
      </div>

      {marketplace === 'meesho' ? (
        <MeeshoAdsView clientName={client?.name ?? 'Client'} snapshot={snapshot} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {client?.name} · {MARKETPLACE_META[marketplace].label}
              </h2>
              <p className="text-sm text-gray-500">
                Wallet {formatMoney(snapshot.wallet)} · {MARKETPLACE_META[marketplace].label} ads
              </p>
            </div>
            <Sparkline values={snapshot.trend} />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Ad spend" value={formatMoney(snapshot.kpis.spend)} />
            <Kpi label="Revenue" value={formatMoney(snapshot.kpis.revenue)} />
            <Kpi label="ROAS" value={snapshot.kpis.roas.toFixed(2)} />
            <Kpi label="Views" value={compact.format(snapshot.kpis.impressions)} />
            <Kpi label="Clicks" value={compact.format(snapshot.kpis.clicks)} />
            <Kpi label="Orders" value={String(snapshot.kpis.orders)} />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {snapshot.extras.map((extra) => (
              <span
                key={extra.label}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600"
              >
                <span className="text-gray-400">{extra.label}:</span>{' '}
                <span className="font-medium text-gray-900">{extra.value}</span>
              </span>
            ))}
          </div>

          <CampaignTable rows={rows} showMarketplace={false} />
        </>
      )}
    </div>
  );
}

/** Cross-platform report for all clients, embedded in the workspace Ads page (platform admins only). */
export function MarketplaceOverviewPanel({
  onSelectPlatform,
}: {
  onSelectPlatform: (marketplace: MarketplaceId) => void;
}) {
  const { total, perPlatform, topRows, trend } = useMemo(() => {
    const perPlatform = MARKETPLACES.map((marketplace) => ({
      marketplace,
      snapshot: platformTotals(marketplace),
    }));
    const total = sumSnapshots(perPlatform.map((item) => item.snapshot));
    const length = Math.max(...perPlatform.map((item) => item.snapshot.trend.length));
    const trend = Array.from({ length }, (_, index) =>
      perPlatform.reduce((sum, item) => sum + (item.snapshot.trend[index] ?? 0), 0),
    );
    const topRows = perPlatform
      .flatMap(({ marketplace, snapshot }) => snapshot.campaigns.map((campaign) => ({ ...campaign, marketplace })))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    return { total, perPlatform, topRows, trend };
  }, []);

  const maxSpend = Math.max(...perPlatform.map((item) => item.snapshot.kpis.spend), 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">All clients · all platforms</h2>
          <p className="text-sm text-gray-500">
            Meta Ads, Google Ads, Blinkit, Meesho, Flipkart and Amazon combined · Wallet {formatMoney(total.wallet)}
          </p>
        </div>
        <Sparkline values={trend} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Ad spend" value={formatMoney(total.kpis.spend)} />
        <Kpi label="Revenue" value={formatMoney(total.kpis.revenue)} />
        <Kpi label="ROAS" value={total.kpis.roas.toFixed(2)} />
        <Kpi label="Views" value={compact.format(total.kpis.impressions)} />
        <Kpi label="Clicks" value={compact.format(total.kpis.clicks)} />
        <Kpi label="Orders" value={String(total.kpis.orders)} />
      </div>

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">By platform</h3>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {perPlatform.map(({ marketplace, snapshot }) => (
          <button
            key={marketplace}
            type="button"
            onClick={() => onSelectPlatform(marketplace)}
            className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${MARKETPLACE_META[marketplace].pill}`}
              >
                {MARKETPLACE_META[marketplace].label}
              </span>
              <span className="text-xs text-gray-400">View details →</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-xs text-gray-400">Spend</div>
                <div className="font-semibold text-gray-900">{formatMoney(snapshot.kpis.spend)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Revenue</div>
                <div className="font-semibold text-gray-900">{formatMoney(snapshot.kpis.revenue)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">ROAS</div>
                <div className="font-semibold text-gray-900">{snapshot.kpis.roas.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(snapshot.kpis.spend / maxSpend) * 100}%`,
                  backgroundColor: MARKETPLACE_META[marketplace].accent,
                }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {compact.format(snapshot.kpis.clicks)} clicks · {snapshot.kpis.orders} orders · {snapshot.campaigns.length}{' '}
              campaigns
            </div>
          </button>
        ))}
      </div>

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Top campaigns by revenue</h3>
      <CampaignTable rows={topRows} showMarketplace />
    </div>
  );
}
