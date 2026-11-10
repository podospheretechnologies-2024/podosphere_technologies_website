'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';
import { errorText, growthCall, useGrowth, type GrowthSettings, type ShopifyStore } from './growth-api';
import { ErrorLine, Field, Panel, Pill, textareaClass } from './growth-ui';

export function SettingsTab({ canReview, onChange }: { canReview: boolean; onChange: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ShopifyPanel canReview={canReview} onChange={onChange} />
      <GoalsPanel canReview={canReview} onChange={onChange} />
    </div>
  );
}

function ShopifyPanel({ canReview, onChange }: { canReview: boolean; onChange: () => void }) {
  const { data: store, mutate } = useGrowth<ShopifyStore>('/shopify');
  const [mode, setMode] = useState<'token' | 'client'>('token');
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
  const form = (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {(
          [
            ['token', 'Admin API access token'],
            ['client', 'Client ID + secret'],
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
      <Field label="Store address (myshopify.com)">
        <Input value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} placeholder="siyara-beauty.myshopify.com" />
      </Field>
      {mode === 'token' ? (
        <Field label="Admin API access token (starts with shpat_)">
          <Input type="password" autoComplete="off" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="shpat_…" />
        </Field>
      ) : (
        <>
          <Field label="Client ID">
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Client secret">
            <Input type="password" autoComplete="off" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          </Field>
        </>
      )}
      <p className="text-muted-foreground text-xs">
        Permissions the app needs: <b>read_orders</b> (sales, orders — required), <b>read_reports</b> (sessions, funnel), <b>read_content</b> +{' '}
        <b>write_content</b> (publish approved blogs). The token is stored encrypted and only used for this client.
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
        {busy === 'connect' ? 'Checking the store…' : 'Connect store'}
      </Button>
    </div>
  );

  return (
    <Panel title="Shopify store">
      {!store && <p className="text-muted-foreground text-sm">Loading…</p>}
      {store && connected && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{store.shopName}</strong>
            <Pill tone={store.status === 'error' ? 'bad' : 'good'}>{store.status === 'error' ? 'Error' : 'Connected'}</Pill>
            <span className="text-muted-foreground text-xs">{store.shopDomain}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            {store.currency} · {store.timeZone} · {store.authMode === 'client_credentials' ? 'client credentials' : 'access token'} · last sync{' '}
            {store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleString('en-IN') : 'not yet'}
          </p>
          {store.lastError && <p className="text-danger text-xs">{store.lastError}</p>}
          {store.missingScopes.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Missing permissions: {store.missingScopes.join(', ')}. Add them to the app, then reconnect.</p>
          )}
          <p className="text-xs">
            Sessions / funnel:{' '}
            {store.trafficAvailable == null ? 'checked on the first sync' : store.trafficAvailable ? 'available' : `not available (${store.trafficError ?? 'unknown'})`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={Boolean(busy)} onClick={() => run('sync', () => growthCall('/shopify/sync', 'POST'))}>
              {busy === 'sync' ? 'Syncing 60 days…' : 'Sync now'}
            </Button>
            {canReview && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
                  Replace token
                </Button>
                <Button
                  size="sm"
                  variant="danger-ghost"
                  onClick={() => {
                    if (window.confirm('Disconnect this store? Synced numbers stay; new syncs stop.')) void run('disconnect', () => growthCall('/shopify', 'DELETE'));
                  }}
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {store && canReview && (!connected || showForm) && form}
      {store && !connected && !canReview && <p className="text-muted-foreground text-sm">Ask an owner or admin to connect this client&apos;s store.</p>}
      <ErrorLine error={error} />
    </Panel>
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
        dailyBudget: form!.dailyBudget,
        budgetCap: form!.budgetCap,
        blogsPerMonth: form!.blogsPerMonth,
        reportEveryDays: form!.reportEveryDays,
        contentSheetUrl: form!.contentSheetUrl || null,
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
      <Field label="Content calendar sheet link (optional)">
        <Input value={form.contentSheetUrl ?? ''} disabled={!canReview} onChange={(e) => set('contentSheetUrl', e.target.value)} placeholder="https://docs.google.com/…" />
      </Field>
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
