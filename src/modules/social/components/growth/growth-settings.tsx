'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';
import { errorText, growthCall, useGrowth, type GrowthSettings, type ShopifyStore } from './growth-api';
import { ErrorLine, Field, Panel, Pill, textareaClass } from './growth-ui';
import { Ga4Panel } from './growth-ga4';
import { ContentSheetPanel } from './growth-content-sheet';

export function SettingsTab({ canReview, onChange }: { canReview: boolean; onChange: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ShopifyPanel canReview={canReview} onChange={onChange} />
      <GoalsPanel canReview={canReview} onChange={onChange} />
      <Ga4Panel canReview={canReview} onChange={onChange} />
      <ContentSheetPanel canReview={canReview} />
    </div>
  );
}

function ShopifyPanel({ canReview, onChange }: { canReview: boolean; onChange: () => void }) {
  const { data: store, mutate } = useGrowth<ShopifyStore>('/shopify');
  const [mode, setMode] = useState<'client' | 'token'>('client');
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

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

  const connected = store?.connected;
  const checks = store?.accessChecks ?? [];
  const missingLive = checks.filter((c) => !c.ok);

  const form = (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {(
          [
            ['client', 'Client ID + secret'],
            ['token', 'Admin API access token'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
            className={cn('rounded-full px-3 py-1 text-xs', mode === id ? 'bg-primary text-primary-foreground' : 'border-border border')}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'token' && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Live order events need Client ID + secret. Use that mode for WhatsApp order flows; a pasted token only covers sales sync.
        </p>
      )}
      <Field label="Store address (myshopify.com)">
        {/* Browsers treat a text field before a password field as a login form and autofill the
            dashboard email + password here. Unique names + new-password stop that. */}
        <Input
          name="shopify-store-domain"
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          value={shopDomain}
          onChange={(e) => setShopDomain(e.target.value)}
          placeholder="siyara-beauty.myshopify.com"
        />
      </Field>
      {mode === 'token' ? (
        <Field label="Admin API access token (starts with shpat_)">
          <Input
            type="password"
            name="shopify-admin-token"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="shpat_…"
          />
        </Field>
      ) : (
        <>
          <Field label="Client ID">
            <Input name="shopify-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" data-1p-ignore data-lpignore="true" />
          </Field>
          <Field label="Client secret">
            <Input
              type="password"
              name="shopify-client-secret"
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </Field>
        </>
      )}
      <p className="text-muted-foreground text-xs">
        Tick on the Shopify app: <b>read_orders</b>, <b>read_fulfillments</b>, <b>read_customers</b>, <b>read_products</b>, plus{' '}
        <b>read_reports</b> / <b>read_content</b> / <b>write_content</b> for Growth. Turn on protected customer data so phone numbers arrive.
      </p>
      <Button
        disabled={Boolean(busy) || !shopDomain || (mode === 'token' ? !accessToken : !clientId || !clientSecret)}
        onClick={() =>
          run('connect', async () => {
            await growthCall('/shopify', 'POST', mode === 'token' ? { shopDomain, accessToken } : { shopDomain, clientId, clientSecret });
            setAccessToken('');
            setClientSecret('');
            setShowForm(false);
          })
        }
      >
        {busy === 'connect' ? 'Checking the store…' : 'Connect'}
      </Button>
    </div>
  );

  return (
    <Panel
      title={store?.shopName ? `Shopify store · ${store.shopName}` : 'Shopify store'}
      action={
        <Button size="sm" variant="secondary" onClick={() => setShowGuide((v) => !v)}>
          {showGuide ? 'Hide guide' : 'Open the guide'}
        </Button>
      }
    >
      {showGuide && <ShopifySetupGuide />}
      {!store && <p className="text-muted-foreground text-sm">Loading…</p>}

      {store && !connected && canReview && (
        <div className="flex flex-col gap-3 text-sm">
          <Step label="Step 1" title="Create the app in Shopify">
            <p className="text-muted-foreground text-xs">
              In the store&apos;s Dev Dashboard, create an app named &quot;Podo Social&quot;, tick the access list, enable protected customer data, then install it on the store.
            </p>
          </Step>
          <Step label="Step 2" title="Paste the app details">
            {form}
          </Step>
        </div>
      )}

      {store && connected && (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={store.status === 'error' ? 'bad' : 'good'}>{store.status === 'error' ? 'Error' : 'Connected'}</Pill>
              <span className="text-muted-foreground text-xs">{store.shopDomain}</span>
            </div>
            <p className="text-muted-foreground text-xs">
              {store.currency} · {store.timeZone} · {store.authMode === 'client_credentials' ? 'client credentials' : 'access token'} · last sync{' '}
              {store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleString('en-IN') : 'not yet'}
            </p>
            {store.lastError && <p className="text-danger text-xs">{store.lastError}</p>}
          </div>

          <Step label="Step 3" title="Access">
            <ul className="flex flex-col gap-1">
              {checks.map((row) => (
                <li key={row.key} className="flex items-center gap-2 text-xs">
                  <span className={row.ok ? 'text-success' : 'text-danger'} aria-hidden>
                    {row.ok ? '✓' : '✗'}
                  </span>
                  <span>{row.label}</span>
                  {!row.ok && <span className="text-muted-foreground">({row.scopes.join(', ')})</span>}
                </li>
              ))}
            </ul>
            {missingLive.length > 0 && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {missingLive.map((r) => r.label).join(', ')} missing: add {missingLive.flatMap((r) => r.scopes).join(', ')} in Shopify, then Re-check.
              </p>
            )}
            {canReview && (
              <Button size="sm" variant="secondary" className="mt-2" disabled={Boolean(busy)} onClick={() => run('recheck', () => growthCall('/shopify/recheck', 'POST'))}>
                {busy === 'recheck' ? 'Checking…' : 'Re-check'}
              </Button>
            )}
          </Step>

          <Step label="Step 4" title="Live events">
            <WebhookHealthLine store={store} />
            {store.orderFlowsPaused && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                WhatsApp order flows are paused
                {store.orderFlowsPausedReason ? `: ${store.orderFlowsPausedReason}` : ''}. Fix delivery, then resume from WhatsApp.
              </p>
            )}
            {!store.canEnableLiveEvents && !store.webhooksEnabled && (
              <p className="text-muted-foreground text-xs">
                {!store.hasClientSecret || store.authMode !== 'client_credentials'
                  ? 'Reconnect with Client ID + secret to turn on live events.'
                  : 'Fix the missing access above, then turn on live events.'}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              WhatsApp Order flows need live events so Shopify can push new orders, shipping, and abandoned checkouts.
            </p>
            {canReview && (
              <div className="mt-2 flex flex-wrap gap-2">
                {!store.webhooksEnabled ? (
                  <Button
                    size="sm"
                    disabled={Boolean(busy) || !store.canEnableLiveEvents}
                    onClick={() => run('webhooks', () => growthCall('/shopify/webhooks/enable', 'POST'))}
                  >
                    {busy === 'webhooks' ? 'Turning on…' : 'Turn on live events'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (window.confirm('Turn off live events for this store? Order WhatsApp flows will stop receiving Shopify updates.')) {
                        void run('webhooks-off', () => growthCall('/shopify/webhooks/disable', 'POST'));
                      }
                    }}
                  >
                    {busy === 'webhooks-off' ? 'Turning off…' : 'Turn off live events'}
                  </Button>
                )}
              </div>
            )}
          </Step>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={Boolean(busy)} onClick={() => run('sync', () => growthCall('/shopify/sync', 'POST'))}>
              {busy === 'sync' ? 'Syncing 60 days…' : 'Sync now'}
            </Button>
            {canReview && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
                  {showForm ? 'Hide reconnect' : 'Reconnect'}
                </Button>
                <Button
                  size="sm"
                  variant="danger-ghost"
                  onClick={() => {
                    if (window.confirm('Disconnect this store? Live events turn off; synced numbers stay.')) {
                      void run('disconnect', () => growthCall('/shopify', 'DELETE'));
                    }
                  }}
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>
          {canReview && showForm && form}
        </div>
      )}

      {store && !connected && !canReview && <p className="text-muted-foreground text-sm">Ask an owner or admin to connect this client&apos;s store.</p>}
      <ErrorLine error={error} />
    </Panel>
  );
}

function Step({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <div className="border-border flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs font-medium">
        <span className="text-muted-foreground">{label}</span> · {title}
      </p>
      {children}
    </div>
  );
}

function WebhookHealthLine({ store }: { store: ShopifyStore }) {
  if (!store.webhooksEnabled) {
    return <p className="text-muted-foreground text-xs">Live events are off.</p>;
  }
  if (store.webhookHealth === 'never') {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Waiting for the first event — place a test order on the store.
      </p>
    );
  }
  if (store.webhookHealth === 'stale') {
    return (
      <p className="text-danger text-xs">
        No event for 24 hours
        {store.lastWebhookAt ? ` (last ${formatAgo(store.lastWebhookAt)})` : ''}. Check the app is still installed and the secret has not changed.
      </p>
    );
  }
  return (
    <p className="text-xs">
      Last event received: {store.lastWebhookAt ? formatAgo(store.lastWebhookAt) : 'just now'}{' '}
      <span className="text-success" aria-hidden>
        ●
      </span>
    </p>
  );
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleString('en-IN');
}

function ShopifySetupGuide() {
  return (
    <div className="border-border bg-surface-muted mb-1 flex flex-col gap-2 rounded-lg border p-3 text-xs">
      <p className="font-medium">Setup guide (one app per client store)</p>
      <ol className="text-muted-foreground list-decimal space-y-1.5 pl-4">
        <li>Open the store&apos;s Shopify Dev Dashboard (owner or app-development access).</li>
        <li>Create an app named <b>Podo Social</b>.</li>
        <li>
          Grant access: <b>read_orders</b>, <b>read_fulfillments</b>, <b>read_customers</b>, <b>read_products</b>,{' '}
          <b>read_reports</b>, <b>read_content</b>, <b>write_content</b>.
        </li>
        <li>In Protected customer data, request name + phone (or orders arrive with phone blanked out).</li>
        <li>Install the app on the store, then copy Client ID and Client secret into Step 2 below.</li>
        <li>Press Connect, fix any red crosses in Access, then Turn on live events.</li>
        <li>Place one test order and confirm &quot;Last event received&quot; updates within a minute.</li>
      </ol>
    </div>
  );
}

function GoalsPanel({ canReview, onChange }: { canReview: boolean; onChange: () => void }) {
  const { data, mutate } = useGrowth<GrowthSettings>('/settings');
  const [form, setForm] = useState<GrowthSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  if (!form) return <Panel title="Goals and desk settings">Loading…</Panel>;

  const set = <K extends keyof GrowthSettings>(key: K, value: GrowthSettings[K]) => setForm({ ...form, [key]: value });
  const numOrNull = (v: string) => (v === '' ? null : Number(v));

  async function save() {
    setMsg(null);
    try {
      await growthCall('/settings', 'PUT', {
        targetRoas: form!.targetRoas,
        targetCpl: form!.targetCpl,
        dailyBudget: form!.dailyBudget,
        budgetCap: form!.budgetCap,
        blogsPerMonth: form!.blogsPerMonth,
        reportEveryDays: form!.reportEveryDays,
        brandContext: form!.brandContext || null,
        insightsEnabled: form!.insightsEnabled,
      });
      setMsg('Saved.');
      void mutate();
      onChange();
    } catch (e) {
      setMsg(errorText(e));
    }
  }

  return (
    <Panel title="Goals and desk settings">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Target ROAS (x)">
          <Input type="number" step="0.5" min={0.1} value={form.targetRoas} disabled={!canReview} onChange={(e) => set('targetRoas', Number(e.target.value))} />
        </Field>
        <Field label="Target CPL (website)">
          <Input
            type="number"
            min={0}
            placeholder="200"
            value={form.targetCpl ?? ''}
            disabled={!canReview}
            onChange={(e) => set('targetCpl', numOrNull(e.target.value))}
          />
        </Field>
        <Field label="Daily budget">
          <Input type="number" min={0} value={form.dailyBudget ?? ''} disabled={!canReview} onChange={(e) => set('dailyBudget', numOrNull(e.target.value))} />
        </Field>
        <Field label="Budget cap">
          <Input type="number" min={0} value={form.budgetCap ?? ''} disabled={!canReview} onChange={(e) => set('budgetCap', numOrNull(e.target.value))} />
        </Field>
        <Field label="Blogs per month">
          <Input type="number" min={0} max={31} value={form.blogsPerMonth} disabled={!canReview} onChange={(e) => set('blogsPerMonth', Number(e.target.value))} />
        </Field>
        <Field label="Report every (days)">
          <Input type="number" min={7} max={31} value={form.reportEveryDays} disabled={!canReview} onChange={(e) => set('reportEveryDays', Number(e.target.value))} />
        </Field>
        <label className="text-muted-foreground flex items-center gap-2 self-end pb-2 text-xs">
          <input type="checkbox" checked={form.insightsEnabled} disabled={!canReview} onChange={(e) => set('insightsEnabled', e.target.checked)} />
          Daily AI check
        </label>
      </div>
      <Field label="Brand facts the AI may use (promise, founder, stores, season). No offers or prices it should invent.">
        <textarea
          className={textareaClass}
          value={form.brandContext ?? ''}
          disabled={!canReview}
          onChange={(e) => set('brandContext', e.target.value)}
          placeholder="e.g. Indian multi-brand beauty store, online + one physical store. Core promise: 100% authentic products. Founder appears in founder-talk reels."
        />
      </Field>
      {canReview && (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save}>
            Save settings
          </Button>
          {msg && <span className="text-muted-foreground text-sm">{msg}</span>}
        </div>
      )}
      {form.lastInsightsAt && <p className="text-muted-foreground text-xs">Last daily check: {new Date(form.lastInsightsAt).toLocaleString('en-IN')}</p>}
    </Panel>
  );
}
