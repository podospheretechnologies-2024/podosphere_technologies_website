'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { apiFetch } from '@/shared/lib/fetcher';
import { count, errorText, GROWTH_API, growthCall, money, pct, useGrowth, type Ga4Row, type Ga4Status, type Ga4Website } from './growth-api';
import { Empty, ErrorLine, Field, Panel, Pill, selectClass } from './growth-ui';

/** Message Google's redirect left in the URL (?ga4=connected or ?ga4Error=…), read once after mount. */
function useGa4RedirectNote(): string | null {
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('ga4Error');
    const connected = params.get('ga4') === 'connected';
    if (!error && !connected) return;
    setNote(error ?? "Google Analytics connected. Pick this client's property below.");
    ['ga4', 'ga4Error', 'tab'].forEach((key) => params.delete(key));
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);
  return note;
}

/** Setup tab: agency-wide Google login + this client's GA4 property. */
export function Ga4Panel({ canReview, onChange }: { canReview: boolean; onChange: () => void }) {
  const { data: status, mutate } = useGrowth<Ga4Status>('/ga4');
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectNote = useGa4RedirectNote();

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await mutate();
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setBusy('connect');
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>(`${GROWTH_API}/ga4/connect`);
      window.location.assign(url);
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  const p = status?.property;
  return (
    <Panel title="Google Analytics (GA4)">
      <p className="text-muted-foreground text-xs">
        Website visits, traffic sources, landing pages and the visit → cart → purchase funnel, read-only. One Google login for the whole agency
        (like Meta and Google Ads); each client gets its own property. The login only needs <b>Viewer</b> on the property.
      </p>
      {redirectNote && <p className="text-sm">{redirectNote}</p>}
      {!status && <p className="text-muted-foreground text-sm">Loading…</p>}

      {status && !status.configured && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Google is not set up on the server: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.
        </p>
      )}

      {status?.configured && !status.connected && (
        <div className="flex flex-col gap-2">
          {status.canConnect ? (
            <>
              <Button disabled={Boolean(busy)} onClick={connect}>
                {busy === 'connect' ? 'Opening Google…' : 'Connect Google Analytics'}
              </Button>
              <p className="text-muted-foreground text-xs">
                Sign in with the Google account that has access to the clients&apos; GA4 properties. Redirect URI to allow on the Google Cloud OAuth
                client: <code className="break-all">{status.redirectUri}</code>
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Ask an owner or admin to connect Google Analytics.</p>
          )}
        </div>
      )}

      {status?.connected && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground text-xs">
            Google login: <b>{status.googleEmail}</b>
          </p>
          {status.connectionError && <p className="text-danger text-xs">{status.connectionError}</p>}

          {p ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{p.displayName}</strong>
                <Pill tone={p.status === 'error' ? 'bad' : 'good'}>{p.status === 'error' ? 'Error' : 'Connected'}</Pill>
                <span className="text-muted-foreground text-xs">property {p.propertyId}</span>
              </div>
              <p className="text-muted-foreground text-xs">
                {[p.accountName, p.currency, p.timeZone].filter(Boolean).join(' · ')} · last sync{' '}
                {p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleString('en-IN') : 'not yet'}
              </p>
              {p.lastError && <p className="text-danger text-xs">{p.lastError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={Boolean(busy)} onClick={() => run('sync', () => growthCall('/ga4/sync', 'POST'))}>
                  {busy === 'sync' ? 'Syncing 90 days…' : 'Sync now'}
                </Button>
                {canReview && (
                  <Button
                    size="sm"
                    variant="danger-ghost"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (window.confirm('Remove this property from the client? Its synced GA4 numbers are deleted here (nothing changes in Google).'))
                        void run('unassign', () => growthCall('/ga4', 'PUT', { propertyId: null }));
                    }}
                  >
                    Remove from client
                  </Button>
                )}
              </div>
            </div>
          ) : canReview ? (
            <div className="flex flex-col gap-2">
              <Field label="GA4 property for this client">
                <select className={selectClass} value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Choose a property…</option>
                  {status.available.map((a) => (
                    <option key={a.propertyId} value={a.propertyId}>
                      {a.accountName ? `${a.accountName} → ` : ''}
                      {a.displayName} ({a.propertyId})
                    </option>
                  ))}
                </select>
              </Field>
              {!status.available.length && (
                <p className="text-muted-foreground text-xs">
                  No free property. In the client&apos;s GA4: Admin → Property access management → add <b>{status.googleEmail}</b> as Viewer, then
                  press Refresh list. Properties already used by another client are not shown.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={Boolean(busy) || !pick}
                  onClick={() =>
                    run('assign', async () => {
                      await growthCall('/ga4', 'PUT', { propertyId: pick });
                      setPick('');
                    })
                  }
                >
                  {busy === 'assign' ? 'Saving…' : 'Use this property'}
                </Button>
                <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => run('refresh', () => growthCall('/ga4/properties', 'POST'))}>
                  {busy === 'refresh' ? 'Listing…' : 'Refresh list'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No GA4 property picked for this client yet.</p>
          )}

          {status.canConnect && (
            <div className="border-border flex flex-wrap gap-2 border-t pt-2">
              <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={connect}>
                Reconnect Google
              </Button>
              <Button
                size="sm"
                variant="danger-ghost"
                disabled={Boolean(busy)}
                onClick={() => {
                  if (window.confirm('Disconnect Google Analytics for the whole agency? Every client loses its property link; synced numbers stay.'))
                    void run('disconnect', () => growthCall('/ga4', 'DELETE'));
                }}
              >
                Disconnect Google
              </Button>
            </div>
          )}
        </div>
      )}
      <ErrorLine error={error} />
    </Panel>
  );
}

function Ga4Table({ title, rows, currency }: { title: string; rows: Ga4Row[]; currency: string }) {
  if (!rows.length) return <Empty>No {title.toLowerCase()} data.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-muted-foreground text-xs">
          <tr className="border-border border-b">
            {[title, 'Sessions', 'Users', 'Add to cart', 'Purchases', 'Conv. rate', 'Revenue'].map((h, i) => (
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
              <td className="px-2 py-1.5 text-right">{count(r.users)}</td>
              <td className="px-2 py-1.5 text-right">{count(r.atc)}</td>
              <td className="px-2 py-1.5 text-right">{count(r.purchases)}</td>
              <td className="px-2 py-1.5 text-right">{pct(r.purchases, r.sessions)}</td>
              <td className="px-2 py-1.5 text-right">{money(r.revenue, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Website tab: GA4 funnel + breakdowns for the last 30 days. */
export function Ga4WebsiteSection({ ga4 }: { ga4: Ga4Website | undefined }) {
  if (!ga4) return null;
  if (!ga4.property) {
    return (
      <Panel title="Google Analytics">
        <Empty>Pick this client&apos;s GA4 property in Setup to see visits, sources and the purchase funnel from Google Analytics.</Empty>
      </Panel>
    );
  }
  const s = ga4.snapshot;
  const currency = ga4.property.currency ?? 'INR';
  if (!s) {
    return (
      <Panel title="Google Analytics">
        <Empty>
          {ga4.property.lastError
            ? `Last GA4 sync failed: ${ga4.property.lastError}`
            : 'The first GA4 sync has not finished yet. Press "Sync now" in Setup.'}
        </Empty>
      </Panel>
    );
  }
  const t = s.totals;
  const steps = [
    ['Sessions', t.sessions],
    ['Added to cart', t.addToCarts],
    ['Checkout', t.checkouts],
    ['Purchases', t.purchases],
  ] as const;
  const noEcommerce = t.sessions > 0 && t.addToCarts === 0 && t.purchases === 0;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Google Analytics funnel">
        <p className="text-muted-foreground text-xs">
          {s.periodStart} to {s.periodEnd} · GA4 · {ga4.property.displayName}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {(
            [
              ['Users', count(t.totalUsers)],
              ['New users', count(t.newUsers)],
              ['Engaged sessions', `${count(t.engagedSessions)} · ${pct(t.engagedSessions, t.sessions)}`],
              ['Revenue', money(t.revenue, currency)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="border-border rounded-lg border px-3 py-2">
              <div className="text-muted-foreground text-xs">{label}</div>
              <strong className="tabular-nums">{value}</strong>
            </div>
          ))}
        </div>
        {steps.map(([label, value], i) => (
          <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span>{label}</span>
            <div className="bg-surface-muted h-5 overflow-hidden rounded-md">
              <i
                className="from-primary to-danger block h-full rounded-md bg-gradient-to-r"
                style={{ width: `${Math.max(0.5, t.sessions ? (value / t.sessions) * 100 : 0)}%` }}
              />
            </div>
            <strong className="tabular-nums">
              {count(value)}
              {i ? ` · ${pct(value, t.sessions)}` : ''}
            </strong>
          </div>
        ))}
        {noEcommerce && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            GA4 sees visits but no add_to_cart or purchase events. E-commerce tracking is probably not installed on this site, so the funnel
            stops at sessions.
          </p>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Channels (GA4)">
          <Ga4Table title="Channel" rows={s.channels} currency={currency} />
        </Panel>
        <Panel title="Source / medium (GA4)">
          <Ga4Table title="Source / medium" rows={s.sources} currency={currency} />
        </Panel>
        <Panel title="Landing pages (GA4)">
          <Ga4Table title="Landing page" rows={s.landing} currency={currency} />
        </Panel>
        <Panel title="Devices (GA4)">
          <Ga4Table title="Device" rows={s.devices} currency={currency} />
        </Panel>
      </div>
    </div>
  );
}
