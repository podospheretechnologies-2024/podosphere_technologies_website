'use client';

import dayjs from 'dayjs';
import { ChevronRight, Download, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import { cn } from '@/shared/lib/cn';
import { ADS_DATE_PRESETS, ADS_DEFAULT_DATE_PRESET, type AdsDatePreset } from '../../config/ads';
import { useAdAccounts, useAdsOverview } from '../../hooks/use-ads';
import type {
  AdAccountItem,
  AdsAdItem,
  AdsAdSetItem,
  AdsCampaignItem,
  AdsDailyPoint,
  AdsLeadItem,
  AdsLiveAd,
  AdsOverview,
} from '../../types/ads';

const count = new Intl.NumberFormat('en-IN');

type AdsLevel = 'campaigns' | 'adsets' | 'ads' | 'leads';

const LEVEL_TABS: { value: AdsLevel; label: string }[] = [
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'adsets', label: 'Ad sets' },
  { value: 'ads', label: 'Ads' },
  { value: 'leads', label: 'Leads' },
];

function money(value: number, currency: string, digits = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: digits,
  }).format(value);
}

function dash(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

function objectiveLabel(objective: string) {
  return objective
    .replace(/^OUTCOME_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function preferredAccount(accounts: AdAccountItem[]): string | null {
  const own = accounts.find((account) => /podosphere/i.test(account.name));
  return (own ?? accounts[0])?.id ?? null;
}

function statusPill(status: string) {
  const live = status === 'ACTIVE';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        live
          ? 'bg-success/15 text-success'
          : 'bg-surface-muted text-muted-foreground'
      )}
    >
      <span className={cn('size-1.5 rounded-full', live ? 'bg-success' : 'bg-muted-foreground/50')} />
      {live ? 'Live' : status.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}

function TagList({ items, limit = 3 }: { items: string[]; limit?: number }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const visible = items.slice(0, limit);
  const rest = items.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((item) => (
        <span
          key={item}
          className="bg-surface-muted text-foreground/90 max-w-[140px] truncate rounded-md px-1.5 py-0.5 text-[11px]"
          title={item}
        >
          {item}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]">+{rest}</span>
      )}
    </div>
  );
}

function MetricCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn('px-4 py-3.5 text-right text-sm tabular-nums', className)}>{children}</td>
  );
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadLeadsSheet(leads: AdsLeadItem[], accountName: string) {
  const header = [
    'Created',
    'Ad set',
    'Creative / Ad',
    'Campaign',
    'Form fields',
    'Lead id',
  ];
  const rows = leads.map((lead) =>
    [
      lead.createdTime,
      lead.adsetName ?? '',
      lead.adName ?? '',
      lead.campaignName ?? '',
      lead.fields.map((field) => `${field.name}: ${field.values.join('; ')}`).join(' | '),
      lead.id,
    ]
      .map(csvEscape)
      .join(',')
  );
  const content = [header.join(','), ...rows].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `podosphere-leads-${accountName.replace(/\W+/g, '-').toLowerCase()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
}

export function AdsDashboard() {
  const accountsQuery = useAdAccounts();
  const [selected, setSelected] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<AdsDatePreset>(ADS_DEFAULT_DATE_PRESET);
  const [focusedCampaignId, setFocusedCampaignId] = useState<string | null>(null);

  const accounts = accountsQuery.data?.accounts ?? [];
  const accountId = selected ?? preferredAccount(accounts);
  const overview = useAdsOverview(accountId, datePreset);

  function selectAccount(id: string) {
    setSelected(id);
    setFocusedCampaignId(null);
  }

  if (accountsQuery.isLoading) {
    return <Card className="text-muted-foreground p-6 text-sm">Loading ad accounts…</Card>;
  }
  if (accountsQuery.error) {
    return <Card className="text-danger p-6 text-sm">{accountsQuery.error.message}</Card>;
  }
  if (!accountsQuery.data?.configured) {
    return (
      <EmptyState
        title="Ads are not connected yet"
        description="Create a system user in Meta Business Manager with ads_read on your ad accounts, then set META_SYSTEM_USER_TOKEN on the server."
      />
    );
  }
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No ad accounts shared"
        description="In Business Manager → System users → podo-social-bot → Assign assets, add the ad accounts you want to see here."
      />
    );
  }

  const liveAds = overview.data
    ? focusedCampaignId
      ? overview.data.liveAds.filter((ad) => ad.campaignId === focusedCampaignId)
      : overview.data.liveAds
    : [];

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm sm:max-w-md">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Ad account
          </span>
          <select
            className="border-border bg-surface focus:border-primary h-10 w-full truncate rounded-lg border px-3 text-sm outline-none transition"
            value={accountId ?? ''}
            onChange={(event) => selectAccount(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.id.replace('act_', '')})
                {account.status !== 1 ? ' · inactive' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="shrink-0">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
            Date range
          </p>
          <SegmentedControl
            label="Date range"
            options={ADS_DATE_PRESETS}
            value={datePreset}
            onChange={setDatePreset}
          />
        </div>
      </Card>

      {overview.error && (
        <Card className="border-danger/30 bg-danger/5 text-danger p-4 text-sm">
          {overview.error.message}
        </Card>
      )}
      {!overview.data && !overview.error && (
        <Card className="text-muted-foreground p-6 text-sm">Loading live data from Meta…</Card>
      )}
      {overview.data && (
        <div className={cn('space-y-6 transition', overview.isValidating && 'opacity-60')}>
          <Totals data={overview.data} />
          <LiveAds ads={liveAds} currency={overview.data.account.currency} />
          <DailySpend points={overview.data.daily} currency={overview.data.account.currency} />
          <AdsHierarchy
            key={overview.data.account.id}
            data={overview.data}
            focusedCampaignId={focusedCampaignId}
            onFocusCampaign={setFocusedCampaignId}
          />
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Read-only view from the Meta Marketing API. Campaigns can&apos;t be paused or edited from
        here.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-surface rounded-xl border p-4">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function Totals({ data }: { data: AdsOverview }) {
  const { totals, account } = data;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Spend" value={money(totals.spend, account.currency)} />
      <Stat label="Impressions" value={count.format(totals.impressions)} />
      <Stat label="Reach" value={count.format(totals.reach)} />
      <Stat label="Clicks" value={count.format(totals.clicks)} />
      <Stat label="CTR" value={`${totals.ctr.toFixed(2)}%`} />
      <Stat label="Cost per click" value={money(totals.cpc, account.currency, 2)} />
      <Stat label="Leads" value={count.format(totals.leads)} />
      <Stat
        label="Cost per lead"
        value={totals.costPerLead === null ? '—' : money(totals.costPerLead, account.currency)}
      />
    </div>
  );
}

function DailySpend({ points, currency }: { points: AdsDailyPoint[]; currency: string }) {
  const max = Math.max(...points.map((point) => point.spend), 0);
  return (
    <Card className="p-5">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Daily spend</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">Spend trend for the selected period</p>
        </div>
        {max > 0 && (
          <p className="text-muted-foreground text-xs tabular-nums">
            Peak {money(max, currency, 2)}
          </p>
        )}
      </div>
      {max === 0 ? (
        <p className="text-muted-foreground text-sm">No spend in this period.</p>
      ) : (
        <div className="flex h-44 items-end gap-px sm:gap-1">
          {points.map((point) => (
            <div
              key={point.date}
              className="bg-primary/70 hover:bg-primary group relative min-w-0 flex-1 rounded-t-sm transition"
              style={{ height: `${Math.max((point.spend / max) * 100, 3)}%` }}
            >
              <div className="border-border bg-surface pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-[11px] shadow-lg group-hover:block">
                <p className="font-medium">{dayjs(point.date).format('D MMM')}</p>
                <p className="text-muted-foreground tabular-nums">
                  {money(point.spend, currency, 2)} · {count.format(point.clicks)} clicks
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LiveAds({ ads, currency }: { ads: AdsLiveAd[]; currency: string }) {
  return (
    <Card className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Live ads</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Creatives currently eligible to serve
          </p>
        </div>
        <span className="bg-success/15 text-success rounded-full px-2.5 py-1 text-[11px] font-semibold">
          {ads.length} live
        </span>
      </div>

      {ads.length === 0 ? (
        <p className="text-muted-foreground text-sm">No ads are live right now.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ads.map((ad) => (
            <li
              key={ad.id}
              className="border-border bg-surface-muted/20 flex flex-col overflow-hidden rounded-xl border"
            >
              <div className="bg-surface-muted relative aspect-[1.91/1] w-full overflow-hidden">
                {ad.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                    No creative preview
                  </div>
                )}
                <span className="bg-success absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                  Live
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-3.5">
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{ad.name}</p>
                  {(ad.campaignName || ad.adsetName) && (
                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {[ad.campaignName, ad.adsetName].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {ad.headline && (
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                      {ad.headline}
                    </p>
                  )}
                </div>
                <div className="border-border mt-auto grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase">Spend</p>
                    <p className="font-semibold tabular-nums">{money(ad.spend, currency)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase">Clicks</p>
                    <p className="font-semibold tabular-nums">{count.format(ad.clicks)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase">CTR</p>
                    <p className="font-semibold tabular-nums">{ad.ctr.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase">Leads</p>
                    <p className="font-semibold tabular-nums">{count.format(ad.leads)}</p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AdsHierarchy({
  data,
  focusedCampaignId,
  onFocusCampaign,
}: {
  data: AdsOverview;
  focusedCampaignId: string | null;
  onFocusCampaign: (id: string | null) => void;
}) {
  const { campaigns, adSets, ads, leads, account } = data;
  const [level, setLevel] = useState<AdsLevel>('campaigns');
  const [selectedAdSetIds, setSelectedAdSetIds] = useState<string[]>([]);

  const focusedCampaign = focusedCampaignId
    ? (campaigns.find((campaign) => campaign.id === focusedCampaignId) ?? null)
    : null;

  const visibleCampaigns = focusedCampaign ? [focusedCampaign] : campaigns;

  const filteredAdSets = useMemo(() => {
    if (!focusedCampaignId) return adSets;
    return adSets.filter((adset) => adset.campaignId === focusedCampaignId);
  }, [adSets, focusedCampaignId]);

  const filteredAds = useMemo(() => {
    if (selectedAdSetIds.length > 0) {
      return ads.filter((ad) => ad.adsetId && selectedAdSetIds.includes(ad.adsetId));
    }
    if (focusedCampaignId) {
      return ads.filter((ad) => ad.campaignId === focusedCampaignId);
    }
    return ads;
  }, [ads, selectedAdSetIds, focusedCampaignId]);

  const filteredLeads = useMemo(() => {
    if (selectedAdSetIds.length > 0) {
      return leads.filter((lead) => lead.adsetId && selectedAdSetIds.includes(lead.adsetId));
    }
    if (focusedCampaignId) {
      return leads.filter((lead) => lead.campaignId === focusedCampaignId);
    }
    return leads;
  }, [leads, selectedAdSetIds, focusedCampaignId]);

  const tabCounts: Record<AdsLevel, number> = {
    campaigns: visibleCampaigns.length,
    adsets: filteredAdSets.length,
    ads: filteredAds.length,
    leads: filteredLeads.length,
  };

  function openCampaign(id: string) {
    onFocusCampaign(id);
    setSelectedAdSetIds([]);
    setLevel('adsets');
  }

  function clearFocus() {
    onFocusCampaign(null);
    setSelectedAdSetIds([]);
    setLevel('campaigns');
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-border space-y-3 border-b px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Ads levels"
            className="bg-surface-muted flex flex-wrap gap-1 rounded-xl p-1"
          >
            {LEVEL_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={level === tab.value}
                onClick={() => setLevel(tab.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  level === tab.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    level === tab.value
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-surface text-muted-foreground'
                  )}
                >
                  {tabCounts[tab.value]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedAdSetIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAdSetIds([])}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs transition hover:border-[var(--border)]"
              >
                Clear ad sets
                <X className="size-3" />
              </button>
            )}
            {level === 'leads' && (
              <Button
                variant="secondary"
                size="sm"
                disabled={filteredLeads.length === 0}
                onClick={() => downloadLeadsSheet(filteredLeads, account.name)}
              >
                <Download className="size-3.5" />
                Download leads
              </Button>
            )}
          </div>
        </div>

        {focusedCampaign && (
          <div className="border-border bg-surface-muted/40 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs">
            <button
              type="button"
              onClick={clearFocus}
              className="text-muted-foreground hover:text-foreground font-medium transition"
            >
              All campaigns
            </button>
            <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-foreground min-w-0 truncate font-semibold">
              {focusedCampaign.name}
            </span>
            <button
              type="button"
              onClick={clearFocus}
              aria-label="Show all campaigns"
              className="text-muted-foreground hover:bg-surface hover:text-foreground ml-auto flex size-6 shrink-0 items-center justify-center rounded-full transition"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {level === 'campaigns' && (
        <CampaignsTable
          campaigns={visibleCampaigns}
          currency={account.currency}
          focusedId={focusedCampaignId}
          onOpen={openCampaign}
        />
      )}
      {level === 'adsets' && (
        <AdSetsTable
          adSets={filteredAdSets}
          currency={account.currency}
          selectedIds={selectedAdSetIds}
          onToggle={(id) => setSelectedAdSetIds((current) => toggleId(current, id))}
        />
      )}
      {level === 'ads' && <AdsTable ads={filteredAds} currency={account.currency} />}
      {level === 'leads' && <LeadsTable leads={filteredLeads} />}
    </Card>
  );
}

function CampaignsTable({
  campaigns,
  currency,
  focusedId,
  onOpen,
}: {
  campaigns: AdsCampaignItem[];
  currency: string;
  focusedId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
        <thead className="bg-surface-muted/50 text-muted-foreground sticky top-0 z-10 text-[11px] tracking-wide uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Campaign</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Budget</th>
            <th className="px-4 py-3 text-right font-semibold">Spend</th>
            <th className="px-4 py-3 text-right font-semibold">Leads</th>
            <th className="px-4 py-3 text-right font-semibold">Cost / lead</th>
            <th className="px-4 py-3 text-right font-semibold">LP views</th>
            <th className="px-4 py-3 text-right font-semibold">CTR</th>
            <th className="px-4 py-3 text-right font-semibold">CPC</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const focused = focusedId === campaign.id;
            return (
              <tr
                key={campaign.id}
                className={cn(
                  'border-border hover:bg-surface-muted/35 cursor-pointer border-b transition last:border-0',
                  focused && 'bg-primary/8'
                )}
                onClick={() => onOpen(campaign.id)}
              >
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    className="group max-w-xs text-left"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(campaign.id);
                    }}
                  >
                    <p className="text-foreground group-hover:text-primary font-medium transition">
                      {campaign.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {objectiveLabel(campaign.objective)}
                    </p>
                  </button>
                </td>
                <td className="px-4 py-3.5">{statusPill(campaign.status)}</td>
                <MetricCell className="text-muted-foreground text-xs">
                  {campaign.budgetLabel ?? 'Ad set budget'}
                </MetricCell>
                <MetricCell>{money(campaign.spend, currency)}</MetricCell>
                <MetricCell>{count.format(campaign.leads)}</MetricCell>
                <MetricCell>
                  {campaign.costPerLead === null ? '—' : money(campaign.costPerLead, currency)}
                </MetricCell>
                <MetricCell>{count.format(campaign.landingPageViews)}</MetricCell>
                <MetricCell>{campaign.ctr.toFixed(2)}%</MetricCell>
                <MetricCell>
                  {campaign.cpc ? money(campaign.cpc, currency, 2) : '—'}
                </MetricCell>
              </tr>
            );
          })}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={9} className="text-muted-foreground px-4 py-10 text-center text-sm">
                No campaigns in this ad account.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdSetsTable({
  adSets,
  currency,
  selectedIds,
  onToggle,
}: {
  adSets: AdsAdSetItem[];
  currency: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-surface-muted/50 text-muted-foreground sticky top-0 z-10 text-[11px] tracking-wide uppercase">
          <tr>
            <th className="w-12 px-4 py-3" />
            <th className="px-4 py-3 font-semibold">Ad set</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Age</th>
            <th className="px-4 py-3 font-semibold">Location</th>
            <th className="px-4 py-3 font-semibold">Interests</th>
            <th className="px-4 py-3 font-semibold">Behaviors</th>
            <th className="px-4 py-3 text-right font-semibold">Spend</th>
            <th className="px-4 py-3 text-right font-semibold">Leads</th>
          </tr>
        </thead>
        <tbody>
          {adSets.map((adset) => {
            const selected = selectedIds.includes(adset.id);
            const age =
              adset.targeting.ageMin !== null || adset.targeting.ageMax !== null
                ? `${adset.targeting.ageMin ?? '—'}–${adset.targeting.ageMax ?? '—'}`
                : '—';
            return (
              <tr
                key={adset.id}
                className={cn(
                  'border-border hover:bg-surface-muted/30 border-b transition last:border-0',
                  selected && 'bg-primary/8'
                )}
              >
                <td className="px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggle(adset.id)}
                    aria-label={`Select ${adset.name}`}
                    className="accent-primary size-3.5 rounded"
                  />
                </td>
                <td className="px-4 py-3.5">
                  <p className="max-w-[220px] font-medium">{adset.name}</p>
                  {adset.campaignName && (
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                      {adset.campaignName}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5">{statusPill(adset.status)}</td>
                <td className="px-4 py-3.5 text-xs tabular-nums">{age}</td>
                <td className="max-w-[180px] px-4 py-3.5">
                  <TagList items={adset.targeting.locations} limit={3} />
                </td>
                <td className="max-w-[200px] px-4 py-3.5">
                  <TagList items={adset.targeting.interests} limit={3} />
                </td>
                <td className="max-w-[200px] px-4 py-3.5">
                  <TagList items={adset.targeting.behaviors} limit={3} />
                </td>
                <MetricCell>{money(adset.spend, currency)}</MetricCell>
                <MetricCell>{count.format(adset.leads)}</MetricCell>
              </tr>
            );
          })}
          {adSets.length === 0 && (
            <tr>
              <td colSpan={9} className="text-muted-foreground px-4 py-10 text-center text-sm">
                No ad sets for the current selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdsTable({ ads, currency }: { ads: AdsAdItem[]; currency: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-surface-muted/50 text-muted-foreground sticky top-0 z-10 text-[11px] tracking-wide uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Ad / Creative</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Primary text</th>
            <th className="px-4 py-3 font-semibold">Headline</th>
            <th className="px-4 py-3 font-semibold">Description</th>
            <th className="px-4 py-3 text-right font-semibold">Spend</th>
            <th className="px-4 py-3 text-right font-semibold">Leads</th>
          </tr>
        </thead>
        <tbody>
          {ads.map((ad) => (
            <tr
              key={ad.id}
              className="border-border hover:bg-surface-muted/30 border-b transition last:border-0"
            >
              <td className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="border-border bg-surface-muted size-14 shrink-0 overflow-hidden rounded-lg border">
                    {ad.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ad.thumbnailUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 max-w-[220px]">
                    <p className="font-medium leading-snug">{ad.name}</p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                      {dash([ad.adsetName, ad.campaignName].filter(Boolean).join(' · '))}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">{statusPill(ad.status)}</td>
              <td className="text-muted-foreground max-w-[220px] px-4 py-3.5 text-xs leading-relaxed">
                <p className="line-clamp-3 whitespace-pre-wrap">{dash(ad.primaryText)}</p>
              </td>
              <td className="max-w-[160px] px-4 py-3.5 text-xs leading-relaxed">
                <p className="line-clamp-2 font-medium">{dash(ad.headline)}</p>
              </td>
              <td className="text-muted-foreground max-w-[160px] px-4 py-3.5 text-xs leading-relaxed">
                <p className="line-clamp-2">{dash(ad.description)}</p>
              </td>
              <MetricCell>{money(ad.spend, currency)}</MetricCell>
              <MetricCell>{count.format(ad.leads)}</MetricCell>
            </tr>
          ))}
          {ads.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted-foreground px-4 py-10 text-center text-sm">
                No ads for the current selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadsTable({ leads }: { leads: AdsLeadItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-left text-sm">
        <thead className="bg-surface-muted/50 text-muted-foreground sticky top-0 z-10 text-[11px] tracking-wide uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Created</th>
            <th className="px-4 py-3 font-semibold">Ad set</th>
            <th className="px-4 py-3 font-semibold">Creative / Ad</th>
            <th className="px-4 py-3 font-semibold">Campaign</th>
            <th className="px-4 py-3 font-semibold">Form answers</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-border hover:bg-surface-muted/30 border-b transition last:border-0"
            >
              <td className="text-muted-foreground whitespace-nowrap px-4 py-3.5 text-xs tabular-nums">
                {lead.createdTime
                  ? dayjs(lead.createdTime).format('D MMM YYYY · h:mm A')
                  : '—'}
              </td>
              <td className="px-4 py-3.5 text-xs font-medium">{dash(lead.adsetName)}</td>
              <td className="px-4 py-3.5 text-xs font-medium">{dash(lead.adName)}</td>
              <td className="text-muted-foreground px-4 py-3.5 text-xs">
                {dash(lead.campaignName)}
              </td>
              <td className="max-w-md px-4 py-3.5 text-xs">
                {lead.fields.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <ul className="space-y-1">
                    {lead.fields.slice(0, 6).map((field) => (
                      <li key={`${lead.id}-${field.name}`} className="leading-relaxed">
                        <span className="text-foreground font-medium">{field.name}</span>
                        <span className="text-muted-foreground"> · {field.values.join(', ')}</span>
                      </li>
                    ))}
                    {lead.fields.length > 6 && (
                      <li className="text-muted-foreground">+{lead.fields.length - 6} more</li>
                    )}
                  </ul>
                )}
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted-foreground px-4 py-10 text-center text-sm">
                No leads retrieved for this period. Ensure the system user has{' '}
                <code className="bg-surface-muted text-foreground rounded px-1.5 py-0.5 text-xs">
                  leads_retrieval
                </code>{' '}
                and the ads used lead forms.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
