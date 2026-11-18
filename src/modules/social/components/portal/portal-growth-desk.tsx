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

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
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
  const [overview, setOverview] = useState(initial);
  const hero = overview.hero;
  const currency = hero.currency;

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Growth</h2>
        <p className="mt-1 text-muted-foreground">
          {hero.storeConnected && hero.shopify.shopName ? `${hero.shopify.shopName} · ` : ''}
          {hero.since} → {hero.until}
        </p>
        {hero.storeNote ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {hero.storeNote}
          </p>
        ) : null}
      </div>

      <div className="-mx-1 mb-6 flex flex-wrap gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm whitespace-nowrap',
              tab === t.id
                ? 'bg-foreground text-background'
                : 'border border-border bg-surface text-muted-foreground hover:bg-surface-muted'
            )}
          >
            {t.label}
            {t.id === 'campaigns' && hero.kpis.pendingCampaigns > 0
              ? ` (${hero.kpis.pendingCampaigns})`
              : ''}
            {t.id === 'blogs' && hero.kpis.draftBlogs > 0 ? ` (${hero.kpis.draftBlogs})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <OverviewPanel hero={hero} currency={currency} /> : null}
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
            void apiFetch<PortalGrowthOverview>('/api/portal/growth').then(setOverview);
          }}
        />
      ) : null}
      {tab === 'blogs' ? (
        <BlogsPanel
          canAct={canAct}
          onChanged={() => {
            void apiFetch<PortalGrowthOverview>('/api/portal/growth').then(setOverview);
          }}
        />
      ) : null}
      {tab === 'ideas' ? <IdeasPanel canAct={canAct} /> : null}
    </div>
  );
}

function OverviewPanel({
  hero,
  currency,
}: {
  hero: PortalGrowthOverview['hero'];
  currency: string;
}) {
  const pct =
    hero.roas == null || hero.targetRoas <= 0
      ? 0
      : Math.min(100, (hero.roas / hero.targetRoas) * 100);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 p-5 text-white">
        <p className="text-xs font-semibold tracking-wider text-white/70 uppercase">
          ROAS vs target ({hero.targetRoas}x)
        </p>
        <p className="mt-1 text-5xl font-bold tabular-nums">{times(hero.roas)}</p>
        <div className="relative mt-3 mb-1 h-3 rounded-full bg-white/20">
          <i
            className="absolute inset-y-0 left-0 rounded-full bg-surface"
            style={{ width: `${pct}%`, minWidth: 4 }}
          />
        </div>
        <p className="text-xs text-white/75">
          {!hero.showSpend
            ? 'Ad spend is hidden for this portal.'
            : hero.onTarget == null
              ? 'Waiting for sales and spend in this period.'
              : hero.onTarget
                ? 'On or above target.'
                : 'Below target — check ads and offers.'}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Posts published" value={count(hero.kpis.posts)} />
        <Stat
          label="Orders"
          value={count(hero.kpis.orders)}
          note={hero.storeConnected ? 'Shopify' : 'Store not connected'}
        />
        <Stat
          label="Revenue"
          value={money(hero.kpis.sales, currency)}
          note={hero.storeConnected ? undefined : 'Store not connected'}
        />
        {hero.showSpend ? (
          <Stat label="Ad spend" value={money(hero.kpis.spend, currency)} />
        ) : (
          <Stat label="Ad spend" value="Hidden" note="Ask your agency to show spend" />
        )}
        <Stat label="Sessions" value={count(hero.kpis.sessions)} note="Website" />
        <Stat
          label="Waiting on you"
          value={String(hero.kpis.pendingCampaigns + hero.kpis.draftBlogs)}
          note={`${hero.kpis.pendingCampaigns} ads · ${hero.kpis.draftBlogs} blogs`}
        />
      </div>
    </div>
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
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="min-w-full text-left text-sm">
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
