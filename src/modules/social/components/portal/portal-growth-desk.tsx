'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import { cn } from '@/shared/lib/cn';
import type { PortalGrowthOverview } from '@/modules/social/server/portal/portal-growth.service';
import type { PortalGrowthContentSummary } from '@/modules/social/server/portal/portal-growth-content.service';
import type { PortalGrowthDeskReport } from '@/modules/social/server/portal/portal-growth-reports.service';
import type { PortalGrowthCampaignItem } from '@/modules/social/server/portal/portal-growth-campaigns.service';
import type { PortalGrowthBlogItem } from '@/modules/social/server/portal/portal-growth-blogs.service';
import type { PortalGrowthIdeaItem } from '@/modules/social/server/portal/portal-growth-ideas.service';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'website', label: 'Website' },
  { id: 'content', label: 'Content' },
  { id: 'reports', label: 'Reports' },
  { id: 'campaigns', label: 'Campaign plan' },
  { id: 'blogs', label: 'Blogs' },
  { id: 'ideas', label: 'Idea box' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const PRESETS = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: 'month', label: 'This month', days: 0 },
  { id: 'life', label: 'Lifetime', days: 365 },
] as const;

type PresetId = (typeof PRESETS)[number]['id'];

function daysForPreset(id: PresetId) {
  if (id === 'month') {
    const now = new Date();
    return Math.max(1, now.getDate());
  }
  return PRESETS.find((p) => p.id === id)?.days ?? 30;
}

function money(value: number | null | undefined, currency: string) {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

function count(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat().format(value);
}

function times(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value}x`;
}

function pct(num: number | null | undefined, den: number | null | undefined) {
  if (num == null || den == null || den <= 0) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function HeroStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{value}</p>
      {note ? <p className="mt-0.5 text-[11px] text-white/65">{note}</p> : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function PortalGrowthDesk({
  initial,
  canAct,
}: {
  initial: PortalGrowthOverview;
  canAct: boolean;
}) {
  const [tab, setTab] = useState<TabId>('overview');
  const [preset, setPreset] = useState<PresetId>('30d');
  const [overview, setOverview] = useState(initial);
  const [loadingRange, setLoadingRange] = useState(false);
  const hero = overview.hero;
  const currency = hero.currency;

  const reloadOverview = useCallback(async (days: number) => {
    setLoadingRange(true);
    try {
      const data = await apiFetch<PortalGrowthOverview>(`/api/portal/growth?days=${days}`);
      setOverview(data);
    } catch {
      /* keep current overview */
    } finally {
      setLoadingRange(false);
    }
  }, []);

  function pickPreset(id: PresetId) {
    if (id === preset) return;
    setPreset(id);
    void reloadOverview(daysForPreset(id));
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Growth</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Ads spend and ROAS for your website
          {hero.storeConnected ? '; Shopify sales when the store is linked.' : '.'}
        </p>
      </div>

      {hero.storeNote ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {hero.storeNote}
        </p>
      ) : null}

      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              disabled={loadingRange}
              onClick={() => pickPreset(p.id)}
              className={cn(
                'rounded-full px-3 py-1 text-sm',
                preset === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-surface-muted'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground text-sm">
          {hero.since} to {hero.until}
        </span>
      </div>

      <OverviewHero hero={hero} currency={currency} onGo={setTab} />

      <nav
        aria-label="Growth sections"
        className="bg-background sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto px-1 py-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'border-border min-h-10 shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap',
              tab === t.id
                ? 'bg-foreground text-background'
                : 'bg-surface text-muted-foreground hover:bg-surface-muted'
            )}
          >
            {t.label}
            {t.id === 'campaigns' && hero.kpis.pendingCampaigns > 0 ? (
              <span className="bg-danger ml-1.5 rounded-full px-1.5 text-xs text-white">
                {hero.kpis.pendingCampaigns}
              </span>
            ) : null}
            {t.id === 'blogs' && hero.kpis.draftBlogs > 0 ? (
              <span className="bg-danger ml-1.5 rounded-full px-1.5 text-xs text-white">
                {hero.kpis.draftBlogs}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Posts published" value={count(hero.kpis.posts)} />
          <Stat
            label="Waiting on you"
            value={String(hero.kpis.pendingCampaigns + hero.kpis.draftBlogs)}
            note={`${hero.kpis.pendingCampaigns} ads · ${hero.kpis.draftBlogs} blogs`}
          />
          {!hero.storeConnected ? (
            <Stat label="Store" value="Not connected" note="Ads and website analytics still show" />
          ) : (
            <Stat
              label="Store"
              value={hero.shopify.shopName ?? 'Shopify'}
              note="Connected"
            />
          )}
        </div>
      ) : null}
      {tab === 'performance' ? (
        <PerformancePanel data={overview.performance} currency={currency} />
      ) : null}
      {tab === 'website' ? <WebsitePanel website={hero.website} /> : null}
      {tab === 'content' ? <ContentPanel /> : null}
      {tab === 'reports' ? <ReportsPanel /> : null}
      {tab === 'campaigns' ? (
        <CampaignsPanel
          canAct={canAct}
          onChanged={() => {
            void reloadOverview(daysForPreset(preset));
          }}
        />
      ) : null}
      {tab === 'blogs' ? (
        <BlogsPanel
          canAct={canAct}
          onChanged={() => {
            void reloadOverview(daysForPreset(preset));
          }}
        />
      ) : null}
      {tab === 'ideas' ? <IdeasPanel canAct={canAct} /> : null}
    </div>
  );
}

function OverviewHero({
  hero,
  currency,
  onGo,
}: {
  hero: PortalGrowthOverview['hero'];
  currency: string;
  onGo: (tab: TabId) => void;
}) {
  const websiteMode = hero.websiteMode;
  const targetCpl = hero.targetCpl;
  const cpl = hero.cpl;
  const roasBar =
    hero.roas == null || hero.targetRoas <= 0
      ? 0
      : Math.min(100, (hero.roas / hero.targetRoas) * 100);
  const cplBar =
    cpl == null || targetCpl <= 0
      ? 0
      : Math.min(100, Math.max(8, (targetCpl / Math.max(cpl, 0.01)) * 100));

  const needs: { label: string; hot: boolean; go: TabId }[] = [
    {
      label: `${hero.kpis.pendingCampaigns} ad${hero.kpis.pendingCampaigns === 1 ? '' : 's'} waiting for approval`,
      hot: hero.kpis.pendingCampaigns > 0,
      go: 'campaigns',
    },
    {
      label: `${hero.kpis.approvedCampaigns} approved, to build`,
      hot: hero.kpis.approvedCampaigns > 0,
      go: 'campaigns',
    },
    {
      label: `${hero.kpis.draftBlogs} blog draft${hero.kpis.draftBlogs === 1 ? '' : 's'}`,
      hot: hero.kpis.draftBlogs > 0,
      go: 'blogs',
    },
  ];
  if (hero.kpis.reportDue) needs.push({ label: 'Report is due', hot: true, go: 'reports' });
  if (!hero.hasAds) needs.unshift({ label: 'Ads not linked yet', hot: true, go: 'performance' });

  return (
    <section className="grid gap-5 rounded-2xl bg-gradient-to-br from-[#3d2163] to-[#7a3f8f] p-5 text-white md:grid-cols-[1.1fr_1.4fr]">
      <div>
        {websiteMode ? (
          <>
            <div className="text-xs font-semibold tracking-wider text-white/70 uppercase">
              Cost per lead vs target ({money(targetCpl, currency)})
            </div>
            <div className="mt-1 text-5xl font-bold tabular-nums">
              {cpl != null ? money(cpl, currency) : '—'}
            </div>
            <div className="relative mt-3 mb-1 h-3 rounded-full bg-white/20">
              <i
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{ width: `${cplBar}%`, minWidth: 4 }}
              />
            </div>
            <div className="text-xs text-white/75">
              {!hero.showSpend
                ? 'Ad spend is hidden for this portal.'
                : cpl != null
                  ? `Website / lead desk · Meta spend ÷ leads.${hero.kpis.spend != null ? ` Spend ${money(hero.kpis.spend, currency)}.` : ''} ${
                      cpl <= targetCpl ? 'On or under target.' : 'Above target — check ads and form quality.'
                    }`
                  : !hero.hasAds
                    ? 'Ads are not linked for your brand yet.'
                    : 'Waiting for Meta leads in this date range.'}
            </div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold tracking-wider text-white/70 uppercase">
              {hero.usingShopifyRoas ? 'Shopify ROAS' : 'Ads ROAS'} vs target ({hero.targetRoas}x)
            </div>
            <div className="mt-1 text-5xl font-bold tabular-nums">{times(hero.roas)}</div>
            <div className="relative mt-3 mb-1 h-3 rounded-full bg-white/20">
              <i
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{ width: `${roasBar}%`, minWidth: 4 }}
              />
            </div>
            <div className="text-xs text-white/75">
              {!hero.showSpend
                ? 'Ad spend is hidden for this portal.'
                : hero.onTarget == null
                  ? 'Waiting for sales and spend in this period.'
                  : hero.onTarget
                    ? 'On or above target.'
                    : 'Below target — check ads and offers.'}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {websiteMode ? (
          <>
            <HeroStat label="Leads" value={count(hero.kpis.leads)} note="From Meta ads" />
            <HeroStat
              label="CPL"
              value={cpl != null ? money(cpl, currency) : '—'}
              note={`Target ${money(targetCpl, currency)}`}
            />
            <HeroStat
              label="Ad spend"
              value={hero.showSpend ? money(hero.kpis.spend, currency) : 'Hidden'}
              note={
                hero.showSpend && hero.kpis.metaSpend != null
                  ? `Meta ${money(hero.kpis.metaSpend, currency)}`
                  : undefined
              }
            />
            <HeroStat
              label="Form / pixel"
              value={count(hero.kpis.purchases)}
              note={hero.kpis.purchases ? 'Rare on lead ads' : 'Purchases N/A for lead ads'}
            />
            <HeroStat
              label="Sessions"
              value={count(hero.kpis.sessions)}
              note={hero.kpis.sessions ? 'From GA4' : 'Website'}
            />
            <HeroStat label="Mode" value="Website" note="Shopify not required" />
          </>
        ) : (
          <>
            <HeroStat
              label="Sales"
              value={money(hero.kpis.sales, currency)}
              note={hero.storeConnected ? 'Shopify' : 'Store not connected'}
            />
            <HeroStat
              label="Ad spend"
              value={hero.showSpend ? money(hero.kpis.spend, currency) : 'Hidden'}
              note={
                hero.showSpend && hero.kpis.metaSpend != null
                  ? `Meta ${money(hero.kpis.metaSpend, currency)}`
                  : undefined
              }
            />
            <HeroStat
              label="Orders"
              value={count(hero.kpis.orders)}
              note={
                hero.kpis.aov != null
                  ? `AOV ${money(hero.kpis.aov, currency)}`
                  : hero.storeConnected
                    ? undefined
                    : 'Store not connected'
              }
            />
            <HeroStat
              label="Sessions"
              value={count(hero.kpis.sessions)}
              note={
                hero.kpis.sessions && hero.kpis.orders != null
                  ? `Order rate ${pct(hero.kpis.orders, hero.kpis.sessions)}`
                  : 'Website'
              }
            />
            <HeroStat
              label="Leads"
              value={count(hero.kpis.leads)}
              note={
                hero.kpis.leads && hero.kpis.metaSpend
                  ? `CPL ${money(hero.kpis.metaSpend / hero.kpis.leads, currency)}`
                  : 'From Meta ads'
              }
            />
            <HeroStat
              label="Meta purchases"
              value={count(hero.kpis.purchases)}
              note="Pixel purchases"
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 md:col-span-2">
        {needs.map((n) => (
          <button
            key={n.label}
            type="button"
            onClick={() => onGo(n.go)}
            className={cn(
              'rounded-lg border px-3 py-1 text-sm',
              n.hot
                ? 'border-white bg-white font-semibold text-[#3d2163]'
                : 'border-white/30 bg-white/10 text-white'
            )}
          >
            {n.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function PerformancePanel({
  data,
  currency,
}: {
  data: PortalGrowthOverview['performance'];
  currency: string;
}) {
  const shopify = data.shopify;
  const ads = data.ads;

  return (
    <div className="space-y-8">
      {data.storeNote ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {data.storeNote}
        </p>
      ) : null}

      {shopify.connected ? (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-foreground">Shopify daily</h3>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Orders" value={count(shopify.totals.orders)} />
            <Stat label="Revenue" value={money(shopify.totals.sales, currency)} />
            <Stat
              label="ROAS"
              value={shopify.showSpend ? times(shopify.totals.roas) : '—'}
              note={shopify.showSpend ? money(shopify.totals.spend, currency) : 'Spend hidden'}
            />
          </div>
          {shopify.days.length === 0 ? (
            <Empty>No order data in this period yet.</Empty>
          ) : (
            <>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface sm:hidden">
                {[...shopify.days].reverse().map((day) => (
                  <li key={day.date} className="flex flex-col gap-1 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{day.date}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.orders} orders · {money(day.sales, currency)}
                      {shopify.showSpend ? ` · spend ${money(day.spend, currency)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-hidden rounded-xl border border-border bg-surface sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-muted text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Orders</th>
                      <th className="px-4 py-3">Sales</th>
                      {shopify.showSpend ? <th className="px-4 py-3">Ad spend</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...shopify.days].reverse().map((day) => (
                      <tr key={day.date}>
                        <td className="px-4 py-2.5 text-foreground">{day.date}</td>
                        <td className="px-4 py-2.5">{day.orders}</td>
                        <td className="px-4 py-2.5">{money(day.sales, currency)}</td>
                        {shopify.showSpend ? (
                          <td className="px-4 py-2.5">{money(day.spend, currency)}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 text-lg font-semibold text-foreground">Ads summary</h3>
        {!ads.connected ? (
          <Empty>No ad accounts linked to your brand yet.</Empty>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Spend"
                value={data.showSpend ? money(ads.totals.spend, currency) : 'Hidden'}
              />
              <Stat label="Purchases" value={count(ads.totals.purchases)} />
              <Stat label="Leads" value={count(ads.totals.leads)} />
              <Stat
                label="Ads ROAS"
                value={data.showSpend ? times(ads.totals.roas) : '—'}
              />
            </div>
            {ads.campaigns.length === 0 ? (
              <Empty>No campaign spend in this period.</Empty>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {ads.campaigns.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.status}
                        {c.leads ? ` · ${c.leads} leads` : ''}
                        {c.purchases ? ` · ${c.purchases} purchases` : ''}
                      </p>
                    </div>
                    <div className="text-sm tabular-nums text-foreground">
                      {data.showSpend ? (
                        <>
                          {money(c.spend, currency)}
                          {c.roas != null ? ` · ${times(c.roas)}` : ''}
                        </>
                      ) : (
                        'Spend hidden'
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function WebsitePanel({ website }: { website: PortalGrowthOverview['hero']['website'] }) {
  if (!website) {
    return (
      <Empty>
        Google Analytics is not linked for your site yet. Ask your agency to assign a GA4 property.
      </Empty>
    );
  }
  return (
    <section>
      <p className="mb-3 text-sm text-muted-foreground">
        {website.propertyName ? `${website.propertyName} · ` : ''}
        {website.since && website.until
          ? `${website.since} → ${website.until}`
          : `Last ${website.days} days`}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sessions" value={count(website.sessions)} />
        <Stat label="Users" value={count(website.users)} />
        <Stat label="Conversions" value={count(website.conversions)} />
      </div>
    </section>
  );
}

function ContentPanel() {
  const [data, setData] = useState<PortalGrowthContentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<PortalGrowthContentSummary>('/api/portal/growth/content');
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load content.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Loading content…</Empty>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Stat label="Draft" value={count(data.counts.draft)} />
        <Stat label="In review" value={count(data.counts.review)} />
        <Stat label="Scheduled" value={count(data.counts.scheduled)} />
        <Stat label="Posted" value={count(data.counts.posted)} />
      </div>
      {data.items.length === 0 ? (
        <Empty>No posts in the schedule window yet.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {data.items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{item.title}</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    item.late ? 'bg-red-50 text-red-700' : 'bg-surface-muted text-muted-foreground'
                  )}
                >
                  {item.stage.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.channel} · {new Date(item.publishDate).toLocaleDateString()}
                {item.url ? (
                  <>
                    {' · '}
                    <a href={item.url} target="_blank" rel="noreferrer" className="underline">
                      Open
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportsPanel() {
  const [reports, setReports] = useState<PortalGrowthDeskReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ reports: PortalGrowthDeskReport[] }>(
          '/api/portal/growth/reports'
        );
        if (!cancelled) setReports(res.reports);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load reports.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Empty>{error}</Empty>;
  if (!reports) return <Empty>Loading reports…</Empty>;
  if (reports.length === 0) {
    return <Empty>No reports yet. Your agency will share them here when ready.</Empty>;
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {reports.map((report) => (
        <li
          key={`${report.kind}-${report.id}`}
          className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-medium text-foreground">{report.title}</p>
            <p className="text-sm text-muted-foreground">
              {report.periodStart.slice(0, 10)} – {report.periodEnd.slice(0, 10)}
            </p>
            {report.summary ? (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{report.summary}</p>
            ) : null}
          </div>
          {report.pdfUrl ? (
            <a
              href={report.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Download PDF
            </a>
          ) : (
            <span className="shrink-0 text-sm text-muted-foreground">
              {report.kind === 'growth' ? 'Summary' : 'PDF preparing…'}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function CampaignsPanel({ canAct, onChanged }: { canAct: boolean; onChanged: () => void }) {
  const [items, setItems] = useState<PortalGrowthCampaignItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<{ items: PortalGrowthCampaignItem[] }>(
      '/api/portal/growth/campaigns'
    );
    setItems(res.items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load campaigns.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function decide(id: string, status: 'approved' | 'rejected') {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/portal/growth/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update campaign.');
    } finally {
      setBusyId(null);
    }
  }

  if (!items && !error) return <Empty>Loading campaign plan…</Empty>;
  if (error && !items) return <Empty>{error}</Empty>;

  const list = items ?? [];
  const pending = list.filter((i) => i.status === 'pending');

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!canAct ? (
        <p className="text-sm text-muted-foreground">View only — ask your agency for Can act to approve ads.</p>
      ) : null}
      {list.length === 0 ? (
        <Empty>No proposed campaigns yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {(pending.length ? pending : list).map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{item.adName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.campaignName} → {item.adsetName}
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {item.status}
                </span>
              </div>
              {item.headline ? <p className="mt-2 text-sm text-foreground">{item.headline}</p> : null}
              {item.primaryText ? (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{item.primaryText}</p>
              ) : null}
              {item.hook ? <p className="mt-1 text-xs text-muted-foreground">Hook: {item.hook}</p> : null}
              {canAct && item.status === 'pending' ? (
                <div className="mt-3 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item.id, 'approved')}
                    className="min-h-11 w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 sm:w-auto"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item.id, 'rejected')}
                    className="min-h-11 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 sm:w-auto"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && list.length > pending.length ? (
        <p className="text-xs text-muted-foreground">
          Showing {pending.length} pending. {list.length - pending.length} other items exist.
        </p>
      ) : null}
    </div>
  );
}

function BlogsPanel({ canAct, onChanged }: { canAct: boolean; onChanged: () => void }) {
  const [blogs, setBlogs] = useState<PortalGrowthBlogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await apiFetch<{ blogs: PortalGrowthBlogItem[] }>('/api/portal/growth/blogs');
    setBlogs(res.blogs);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load blogs.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function decide(id: string, action: 'approve' | 'changes') {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/portal/growth/blogs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          feedback: feedback[id]?.trim() || undefined,
        }),
      });
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update blog.');
    } finally {
      setBusyId(null);
    }
  }

  if (!blogs && !error) return <Empty>Loading blogs…</Empty>;
  if (error && !blogs) return <Empty>{error}</Empty>;
  const list = blogs ?? [];

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!canAct ? (
        <p className="text-sm text-muted-foreground">View only — ask your agency for Can act to approve drafts.</p>
      ) : null}
      {list.length === 0 ? (
        <Empty>No blog drafts to review yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((blog) => (
            <li key={blog.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-foreground">{blog.title}</p>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {blog.status}
                </span>
              </div>
              {blog.angle ? <p className="mt-1 text-sm text-muted-foreground">{blog.angle}</p> : null}
              {blog.excerpt ? (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{blog.excerpt}</p>
              ) : null}
              {blog.feedback ? (
                <p className="mt-2 text-xs text-amber-800">Feedback: {blog.feedback}</p>
              ) : null}
              {blog.publishedUrl ? (
                <a
                  href={blog.publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm underline"
                >
                  View published
                </a>
              ) : null}
              {canAct && ['draft', 'changes'].includes(blog.status) ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Optional notes / what to change"
                    value={feedback[blog.id] ?? ''}
                    onChange={(e) =>
                      setFeedback((prev) => ({ ...prev, [blog.id]: e.target.value }))
                    }
                  />
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <button
                      type="button"
                      disabled={busyId === blog.id}
                      onClick={() => void decide(blog.id, 'approve')}
                      className="min-h-11 w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 sm:w-auto"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === blog.id}
                      onClick={() => void decide(blog.id, 'changes')}
                      className="min-h-11 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 sm:w-auto"
                    >
                      Ask for changes
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IdeasPanel({ canAct }: { canAct: boolean }) {
  const [ideas, setIdeas] = useState<PortalGrowthIdeaItem[] | null>(null);
  const [ask, setAsk] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch<{ ideas: PortalGrowthIdeaItem[] }>('/api/portal/growth/ideas');
    setIdeas(res.ideas);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load ideas.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/portal/growth/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ask: ask.trim() }),
      });
      setAsk('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send idea.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canAct ? (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium text-foreground">Send an idea to your agency</p>
          <p className="mb-3 text-xs text-muted-foreground">
            No AI runs here — your team will pick it up in the Growth Idea box.
          </p>
          {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
          <textarea
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            rows={4}
            placeholder="What should we try next?"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
          />
          <button
            type="button"
            disabled={saving || ask.trim().length < 3}
            onClick={() => void submit()}
            className="mt-3 min-h-11 w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Sending…' : 'Send idea'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">View only — ask your agency for Can act to send ideas.</p>
      )}

      {!ideas ? (
        <Empty>Loading ideas…</Empty>
      ) : ideas.length === 0 ? (
        <Empty>No ideas sent yet.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {ideas.map((idea) => (
            <li key={idea.id} className="px-4 py-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">{idea.ask}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(idea.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
