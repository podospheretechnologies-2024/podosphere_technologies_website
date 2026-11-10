'use client';

import { count, pct, useGrowth, type Ga4Website, type ShopifyStore, type TasksPayload } from './growth-api';
import { Empty, ErrorLine, Panel } from './growth-ui';
import { Ga4WebsiteSection } from './growth-ga4';

interface RateRow {
  name: string;
  sessions: number;
  atc: number;
}
interface WebsitePayload {
  store: ShopifyStore;
  ga4: Ga4Website;
  snapshot: {
    periodStart: string;
    periodEnd: string;
    sessions: number;
    addToCart: number;
    orders: number;
    landing: RateRow[];
    sources: RateRow[];
    devices: RateRow[];
    note: string | null;
  } | null;
}

function RateTable({ title, rows }: { title: string; rows: RateRow[] }) {
  if (!rows.length) return <Empty>No {title.toLowerCase()} data.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-muted-foreground text-xs">
          <tr className="border-border border-b">
            {[title, 'Sessions', 'Add to cart', 'Cart rate'].map((h, i) => (
              <th key={h} className={`px-2 py-1.5 font-medium ${i ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-border border-b">
              <td className="max-w-72 px-2 py-1.5 break-words">{r.name}</td>
              <td className="px-2 py-1.5 text-right">{count(r.sessions)}</td>
              <td className="px-2 py-1.5 text-right">{count(r.atc)}</td>
              <td className="px-2 py-1.5 text-right">{pct(r.atc, r.sessions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WebsiteTab() {
  const { data, error } = useGrowth<WebsitePayload>('/website');
  const tasks = useGrowth<TasksPayload>('/tasks');
  const web = (tasks.data?.tasks ?? []).filter((t) => t.area === 'website' && t.status === 'todo');
  const s = data?.snapshot;

  return (
    <div className="flex flex-col gap-4">
      <ErrorLine error={error?.message ?? null} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Store funnel">
          {!data?.store.connected && <Empty>Connect the Shopify store in Setup to see the funnel.</Empty>}
          {data?.store.connected && !s && (
            <Empty>
              {data.store.trafficAvailable === false
                ? `Shopify did not return session data: ${data.store.trafficError ?? 'unknown reason'}. Orders and sales still work.`
                : 'The first sync has not finished yet. Press "Sync now" in Setup.'}
            </Empty>
          )}
          {s && (
            <>
              <p className="text-muted-foreground text-xs">
                {s.periodStart} to {s.periodEnd} · Shopify
              </p>
              {(
                [
                  ['Sessions', s.sessions],
                  ['Added to cart', s.addToCart],
                  ['Orders', s.orders],
                ] as const
              ).map(([label, value], i) => (
                <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <span>{label}</span>
                  <div className="bg-surface-muted h-5 overflow-hidden rounded-md">
                    <i
                      className="from-primary to-danger block h-full rounded-md bg-gradient-to-r"
                      style={{ width: `${Math.max(0.5, s.sessions ? (value / s.sessions) * 100 : 0)}%` }}
                    />
                  </div>
                  <strong className="tabular-nums">
                    {count(value)}
                    {i ? ` · ${pct(value, s.sessions)}` : ''}
                  </strong>
                </div>
              ))}
            </>
          )}
        </Panel>
        <Panel title="Website tasks">
          <p className="text-muted-foreground text-xs">Fixes on the store that should lift the order rate. Tick them off under Today.</p>
          {!web.length && <Empty>No open website tasks.</Empty>}
          {web.map((t) => (
            <div key={t.id} className="border-border border-t pt-2 text-sm first:border-0 first:pt-0">
              <strong>{t.title}</strong>
              {t.detail && <p className="text-muted-foreground text-xs whitespace-pre-wrap">{t.detail}</p>}
            </div>
          ))}
        </Panel>
      </div>
      {s && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Where visitors land">
            <RateTable title="Landing page" rows={s.landing} />
          </Panel>
          <Panel title="Traffic sources and devices">
            <RateTable title="Source" rows={s.sources} />
            <RateTable title="Device" rows={s.devices} />
          </Panel>
        </div>
      )}
      <Ga4WebsiteSection ga4={data?.ga4} />
    </div>
  );
}
