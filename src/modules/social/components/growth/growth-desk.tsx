'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { useClientScope } from '../../hooks/use-client-scope';
import { count, money, pct, times, useGrowth, type Overview } from './growth-api';
import { Empty, ErrorLine, Pill } from './growth-ui';
import { TodayTab, ReviewTab } from './growth-tasks';
import { PerformanceTab } from './growth-performance';
import { CampaignPlanTab } from './growth-campaign-plan';
import { ContentTab } from './growth-content';
import { BlogsTab } from './growth-blogs';
import { ImagesTab } from './growth-images';
import { WebsiteTab } from './growth-website';
import { IdeasTab, IdeaBoxTab } from './growth-ideas';
import { ChangeLogTab } from './growth-changelog';
import { ReportsTab } from './growth-reports';
import { SettingsTab } from './growth-settings';

const PRESETS = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'life', label: 'Lifetime' },
  { id: 'custom', label: 'Custom' },
] as const;

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'ask', label: 'Idea box' },
  { id: 'review', label: 'Review' },
  { id: 'performance', label: 'Performance' },
  { id: 'campaigns', label: 'Campaign plan' },
  { id: 'content', label: 'Content' },
  { id: 'blogs', label: 'Blogs' },
  { id: 'images', label: 'Images' },
  { id: 'website', label: 'Website' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'log', label: 'Change log' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Setup' },
] as const;
export type GrowthTab = (typeof TABS)[number]['id'];

export function GrowthDesk() {
  const { selectedClientId, clients, setSelectedClientId } = useClientScope();
  const [startTab, setStartTab] = useState<GrowthTab>('today');
  if (!selectedClientId)
    return (
      <ClientsSummary
        onPick={(id, tab = 'today') => {
          setStartTab(tab);
          void setSelectedClientId(id);
        }}
        hasClients={clients.length > 0}
      />
    );
  return <ClientDesk key={selectedClientId} initialTab={startTab} />;
}

interface SummaryRow {
  id: string;
  name: string;
  storeConnected: boolean;
  storeStatus: string | null;
  hasAds: boolean;
  sales7d: number | null;
  orders7d: number | null;
  spend7d: number | null;
  roas7d: number | null;
  metaRoas7d: number | null;
  targetRoas: number;
  openTasks: number;
  reviewTasks: number;
}

function ClientsSummary({ onPick, hasClients }: { onPick: (id: string, tab?: GrowthTab) => void; hasClients: boolean }) {
  const { data, error, isLoading } = useGrowth<SummaryRow[]>('/summary');
  const connectedCount = data?.filter((row) => row.storeConnected).length ?? 0;
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Every client is listed here. Use <b>Connect Shopify</b> on a client that sells on Shopify; the others still get tasks, content and
        reports. Last 7 days: Shopify sales ÷ Meta spend, against each client&apos;s ROAS target.
        {data && data.length > 0 && ` ${connectedCount} of ${data.length} stores connected.`}
      </p>
      <p className="text-muted-foreground text-xs">Client missing? Add it on the Clients page, then assign its Meta ad account on the Ads page.</p>
      <ErrorLine error={error?.message ?? null} />
      {isLoading && <Empty>Loading clients…</Empty>}
      {!hasClients && <Empty>No clients yet. Add one on the Clients page.</Empty>}
      {data && data.length > 0 && (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-muted-foreground text-xs">
              <tr className="border-border border-b">
                {['Client', 'Store', 'Sales 7d', 'Orders', 'Ad spend 7d', 'ROAS', 'Meta ROAS', 'Target', 'Open tasks', 'To review', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-border border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">
                    {row.storeConnected ? <Pill tone={row.storeStatus === 'error' ? 'bad' : 'good'}>{row.storeStatus === 'error' ? 'Error' : 'Shopify'}</Pill> : <Pill>Not connected</Pill>}
                  </td>
                  <td className="px-3 py-2">{money(row.sales7d)}</td>
                  <td className="px-3 py-2">{count(row.orders7d)}</td>
                  <td className="px-3 py-2">{row.hasAds ? money(row.spend7d) : '–'}</td>
                  <td className={cn('px-3 py-2 font-semibold', row.roas7d != null && (row.roas7d >= row.targetRoas ? 'text-success' : 'text-danger'))}>
                    {times(row.roas7d)}
                  </td>
                  <td className="px-3 py-2">{times(row.metaRoas7d)}</td>
                  <td className="px-3 py-2">{row.targetRoas}x</td>
                  <td className="px-3 py-2">{row.openTasks}</td>
                  <td className="px-3 py-2">{row.reviewTasks}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 whitespace-nowrap">
                      {!row.storeConnected && (
                        <Button size="sm" onClick={() => onPick(row.id, 'settings')}>
                          Connect Shopify
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => onPick(row.id)}>
                        Open desk
                      </Button>
                    </div>
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

function ClientDesk({ initialTab = 'today' }: { initialTab?: GrowthTab }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const [tab, setTab] = useState<GrowthTab>(initialTab);
  // OAuth redirects (e.g. Google Analytics) come back with ?tab=settings.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    const match = TABS.find((t) => t.id === wanted);
    if (match) setTab(match.id);
  }, []);

  const query =
    preset === 'custom' && applied ? `?preset=custom&from=${applied.from}&to=${applied.to}` : `?preset=${preset === 'custom' ? '7d' : preset}`;
  const { data, error, mutate } = useGrowth<Overview>(`/overview${query}`);

  if (error) return <ErrorLine error={error.message} />;
  if (!data) return <Empty>Loading the desk…</Empty>;

  const currency = data.store.currency ?? 'INR';
  const t = data.totals;
  const target = data.settings.targetRoas;
  const roasPct = t.roas == null ? 0 : Math.min(100, (t.roas / target) * 100);
  const c = data.counts;

  const needs: { label: string; hot: boolean; go: GrowthTab }[] = [
    { label: `${c.pendingAds} ad${c.pendingAds === 1 ? '' : 's'} waiting for approval`, hot: c.pendingAds > 0, go: 'campaigns' },
    { label: `${c.approvedAds} approved, to build`, hot: c.approvedAds > 0, go: 'campaigns' },
    { label: `${c.openTasks} task${c.openTasks === 1 ? '' : 's'} open`, hot: c.openTasks > 0, go: 'today' },
    { label: `${c.reviewTasks} to review`, hot: c.reviewTasks > 0, go: 'review' },
    { label: `${c.draftBlogs} blog draft${c.draftBlogs === 1 ? '' : 's'}`, hot: c.draftBlogs > 0, go: 'blogs' },
  ];
  if (c.reportDue) needs.push({ label: 'Report is due', hot: true, go: 'reports' });
  if (!data.store.connected) needs.unshift({ label: 'Connect Shopify', hot: true, go: 'settings' });

  const badge: Partial<Record<GrowthTab, number>> = { today: c.openTasks, review: c.reviewTasks, campaigns: c.pendingAds, blogs: c.draftBlogs };

  return (
    <div className="space-y-4">
      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                'rounded-full px-3 py-1 text-sm',
                preset === p.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-muted'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" aria-label="From date" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" aria-label="To date" />
            <Button size="sm" disabled={!from || !to} onClick={() => setApplied({ from, to })}>
              Apply
            </Button>
          </div>
        )}
        <span className="text-muted-foreground text-sm">
          {data.range.from} to {data.range.to}
        </span>
      </div>

      <section className="grid gap-5 rounded-2xl bg-gradient-to-br from-[#3d2163] to-[#7a3f8f] p-5 text-white md:grid-cols-[1.1fr_1.4fr]">
        <div>
          <div className="text-xs font-semibold tracking-wider text-white/70 uppercase">ROAS vs target ({target}x)</div>
          <div className="mt-1 text-5xl font-bold tabular-nums">{times(t.roas)}</div>
          <div className="relative mt-3 mb-1 h-3 rounded-full bg-white/20">
            <i className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${roasPct}%`, minWidth: 4 }} />
          </div>
          <div className="text-xs text-white/75">
            {t.roas != null
              ? `Shopify sales ÷ Meta spend.${t.metaRoas != null ? ` Meta-reported: ${times(t.metaRoas)}.` : ''}`
              : !data.store.connected
                ? 'Connect the Shopify store (Setup tab) to see real ROAS.'
                : !data.hasAds
                  ? 'No Meta ad account is assigned to this client yet (Ads page → assign to client).'
                  : 'No ad spend for these dates yet.'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Sales" value={money(t.sales, currency)} note="Shopify" />
          <Stat label="Ad spend" value={money(t.spend, currency)} note={data.hasAds ? 'Meta Ads' : 'No ad account'} />
          <Stat label="Orders" value={count(t.orders)} note={t.aov != null ? `AOV ${money(t.aov, currency)}` : ''} />
          <Stat label="Sessions" value={count(t.sessions)} note={t.sessions ? `Order rate ${pct(t.orders, t.sessions)}` : 'Needs read_reports'} />
          <Stat label="Add to cart" value={count(t.atc)} note={t.sessions ? `Cart rate ${pct(t.atc, t.sessions)}` : ''} />
          <Stat label="Meta purchases" value={count(t.metaPurchases)} note={t.metaPurchases ? `CPP ${money((t.spend ?? 0) / t.metaPurchases, currency)}` : ''} />
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          {needs.map((n) => (
            <button
              key={n.label}
              type="button"
              onClick={() => setTab(n.go)}
              className={cn(
                'rounded-lg border px-3 py-1 text-sm',
                n.hot ? 'border-white bg-white font-semibold text-[#3d2163]' : 'border-white/30 bg-white/10 text-white'
              )}
            >
              {n.label}
            </button>
          ))}
          <span className="self-center text-xs text-white/70">
            Daily budget {money(data.settings.dailyBudget, currency)} · cap {money(data.settings.budgetCap, currency)}
          </span>
        </div>
      </section>

      <nav aria-label="Desk sections" className="bg-background sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto px-1 py-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'border-border rounded-full border px-3 py-1.5 text-sm whitespace-nowrap',
              tab === item.id ? 'bg-foreground text-background' : 'bg-surface hover:bg-surface-muted'
            )}
          >
            {item.label}
            {badge[item.id] ? <span className="bg-danger ml-1.5 rounded-full px-1.5 text-xs text-white">{badge[item.id]}</span> : null}
          </button>
        ))}
      </nav>

      {tab === 'today' && <TodayTab onChange={() => void mutate()} />}
      {tab === 'review' && <ReviewTab onChange={() => void mutate()} />}
      {tab === 'performance' && <PerformanceTab data={data} />}
      {tab === 'campaigns' && <CampaignPlanTab onChange={() => void mutate()} />}
      {tab === 'content' && <ContentTab />}
      {tab === 'blogs' && <BlogsTab onChange={() => void mutate()} storeConnected={data.store.connected} />}
      {tab === 'images' && <ImagesTab brand={data.client.name} />}
      {tab === 'website' && <WebsiteTab />}
      {tab === 'ideas' && <IdeasTab />}
      {tab === 'ask' && <IdeaBoxTab onChange={() => void mutate()} />}
      {tab === 'log' && <ChangeLogTab />}
      {tab === 'reports' && <ReportsTab currency={currency} onChange={() => void mutate()} nextDue={c.nextReportDue} due={c.reportDue} />}
      {tab === 'settings' && <SettingsTab canReview={data.canReview} onChange={() => void mutate()} />}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/12 px-3 py-2">
      <div className="text-[11px] font-semibold tracking-wider text-white/70 uppercase">{label}</div>
      <div className="truncate text-xl font-semibold tabular-nums">{value}</div>
      <div className="truncate text-xs text-white/70">{note}</div>
    </div>
  );
}
