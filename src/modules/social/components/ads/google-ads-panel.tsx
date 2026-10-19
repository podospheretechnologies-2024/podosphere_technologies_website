'use client';

import { RefreshCw } from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ADS_DATE_PRESETS, ADS_DEFAULT_DATE_PRESET, type AdsDatePreset } from '../../config/ads';
import { ClientScopeContext } from '../../hooks/use-client-scope';
import {
  assignGoogleAdsAccount,
  disconnectGoogleAds,
  startGoogleAdsConnect,
  syncGoogleAdsAccounts,
  useGoogleAdsOverview,
  useGoogleAdsStatus,
} from '../../hooks/use-google-ads';
import type { AdsTotals } from '../../types/ads';
import type { GoogleAdsOverview } from '../../types/google-ads';

const TABLE_PREVIEW = 10;

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

const count = (value: number) => new Intl.NumberFormat('en-IN').format(Math.round(value));

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E8EAED] bg-white p-3.5 shadow-sm">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#1C1E21]">{value}</p>
    </div>
  );
}

function Totals({ totals, currency }: { totals: AdsTotals; currency: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Spend" value={money(totals.spend, currency)} />
      <Stat label="Impressions" value={count(totals.impressions)} />
      <Stat label="Clicks" value={count(totals.clicks)} />
      <Stat label="CTR" value={`${totals.ctr.toFixed(2)}%`} />
      <Stat label="Avg. CPC" value={money(totals.cpc, currency)} />
      <Stat label="Conversions" value={totals.leads.toFixed(1)} />
    </div>
  );
}

function DailySpend({ daily, currency }: { daily: GoogleAdsOverview['daily']; currency: string }) {
  if (daily.length === 0) return null;
  const max = Math.max(...daily.map((point) => point.spend), 0);
  return (
    <Card className="space-y-2">
      <h3 className="text-sm font-semibold text-[#1C1E21]">Daily spend</h3>
      <div className="flex h-28 items-end gap-0.5">
        {daily.map((point) => (
          <div
            key={point.date}
            title={`${point.date}: ${money(point.spend, currency)} · ${point.clicks} clicks`}
            className="min-h-px flex-1 rounded-t bg-[#4285F4]"
            style={{ height: `${max > 0 ? (point.spend / max) * 100 : 0}%` }}
          />
        ))}
      </div>
    </Card>
  );
}

interface TableRow {
  id: string;
  name: string;
  sub?: string | null;
  status: string;
  spend: number;
  leads: number;
  costPerLead: number | null;
  clicks?: number;
}

function EntityTable({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: TableRow[];
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, TABLE_PREVIEW);
  return (
    <Card className="space-y-3 overflow-hidden">
      <h3 className="text-sm font-semibold text-[#1C1E21]">
        {title} <span className="text-muted-foreground font-normal">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing in this date range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Name</th>
                <th className="py-1.5 pr-3 font-medium">Status</th>
                <th className="py-1.5 pr-3 text-right font-medium">Spend</th>
                <th className="py-1.5 pr-3 text-right font-medium">Clicks</th>
                <th className="py-1.5 pr-3 text-right font-medium">Conv.</th>
                <th className="py-1.5 text-right font-medium">Cost / conv.</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t border-[#F0F2F5]">
                  <td className="max-w-[280px] py-2 pr-3">
                    <p className="truncate font-medium text-[#1C1E21]">{row.name}</p>
                    {row.sub ? (
                      <p className="text-muted-foreground truncate text-xs">{row.sub}</p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === 'ACTIVE'
                          ? 'bg-[#E6F4EA] text-[#137333]'
                          : 'bg-[#F1F3F4] text-[#5F6368]'
                      }`}
                    >
                      {row.status === 'ACTIVE' ? 'Active' : row.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">{money(row.spend, currency)}</td>
                  <td className="py-2 pr-3 text-right">
                    {row.clicks === undefined ? '–' : count(row.clicks)}
                  </td>
                  <td className="py-2 pr-3 text-right">{row.leads.toFixed(1)}</td>
                  <td className="py-2 text-right">
                    {row.costPerLead === null ? '–' : money(row.costPerLead, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > TABLE_PREVIEW && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </Button>
      )}
    </Card>
  );
}

export function GoogleAdsPanel() {
  const status = useGoogleAdsStatus();
  const clientScope = useContext(ClientScopeContext);
  const [selected, setSelected] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<AdsDatePreset>(ADS_DEFAULT_DATE_PRESET);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  // The OAuth callback redirects back with ?googleAds=connected or ?error=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) setMessage({ kind: 'error', text: error });
    else if (params.get('googleAds') === 'connected') {
      setMessage({ kind: 'ok', text: 'Google Ads connected.' });
    }
  }, []);

  const accounts = status.data?.accounts ?? [];
  const accountId =
    selected && accounts.some((account) => account.id === selected)
      ? selected
      : (accounts[0]?.id ?? null);
  const overview = useGoogleAdsOverview(accountId, { mode: 'preset', datePreset });
  const connection = status.data?.connection;

  async function run(kind: 'connect' | 'sync' | 'disconnect', action: () => Promise<void>) {
    setMessage(null);
    setBusy(kind);
    try {
      await action();
    } catch (failure) {
      setMessage({
        kind: 'error',
        text: failure instanceof Error ? failure.message : 'Something went wrong',
      });
    } finally {
      setBusy(null);
    }
  }

  const sync = () =>
    run('sync', async () => {
      await syncGoogleAdsAccounts();
      await status.mutate();
      await overview.mutate();
    });

  const disconnect = () => {
    if (!window.confirm('Disconnect Google Ads? Synced accounts will be removed from Podo.')) return;
    return run('disconnect', async () => {
      await disconnectGoogleAds();
      setSelected(null);
      await status.mutate();
    });
  };

  async function assign(clientId: string | null) {
    if (!accountId) return;
    await run('sync', async () => {
      await assignGoogleAdsAccount(accountId, clientId);
      await status.mutate();
    });
  }

  if (status.isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading Google Ads…</p>;
  }
  if (status.error) {
    return <p className="text-danger p-6 text-sm">{status.error.message}</p>;
  }

  const current = accounts.find((account) => account.id === accountId);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-[#E8EAED]">
              <GoogleMark className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-[#1C1E21]">Google Ads</h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {connection?.connected
                  ? `Connected as ${connection.email} (read-only).`
                  : 'Connect your Google Ads login to see spend, campaigns and conversions here (read-only).'}
              </p>
            </div>
          </div>
          {connection?.connected ? (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" onClick={sync} disabled={busy !== null}>
                <RefreshCw className={`size-3.5 ${busy === 'sync' ? 'animate-spin' : ''}`} />
                Sync accounts
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={disconnect}
                disabled={busy !== null}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => run('connect', startGoogleAdsConnect)}
              disabled={busy !== null || connection?.configured === false}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#DADCE0] bg-white px-3.5 text-sm font-medium whitespace-nowrap text-[#3C4043] shadow-sm transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GoogleMark className="size-4 shrink-0" />
              {busy === 'connect' ? 'Opening…' : 'Connect Google Ads'}
            </button>
          )}
        </div>

        {connection?.configured === false && (
          <p className="text-muted-foreground rounded-xl border border-dashed border-[#DADCE0] bg-[#F8F9FA] px-3 py-2.5 text-sm">
            Set{' '}
            {connection.missing.map((name, index) => (
              <span key={name}>
                {index > 0 ? ', ' : ''}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">{name}</code>
              </span>
            ))}{' '}
            in <code className="rounded bg-white px-1.5 py-0.5 text-xs">.env</code>, then restart the
            server.
          </p>
        )}
        {connection?.lastError && (
          <p
            role="alert"
            className="border-danger/40 bg-danger/10 text-danger rounded-xl border px-3 py-2.5 text-sm"
          >
            Could not list accounts: {connection.lastError}
          </p>
        )}
        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-xl border px-3 py-2.5 text-sm ${
              message.kind === 'error'
                ? 'border-danger/40 bg-danger/10 text-danger'
                : 'border-success/40 bg-success/10 text-success'
            }`}
          >
            {message.text}
          </p>
        )}
      </Card>

      {connection?.connected && accounts.length === 0 && !connection.lastError && (
        <p className="text-muted-foreground rounded-xl border border-dashed border-[#DADCE0] px-3 py-6 text-center text-sm">
          No Google Ads accounts are visible for this client scope. Use “Sync accounts”, or assign an
          account to this client.
        </p>
      )}

      {accounts.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={accountId ?? ''}
              onChange={(event) => setSelected(event.target.value)}
              className="h-9 rounded-lg border border-[#DADCE0] bg-white px-3 text-sm"
              aria-label="Google Ads account"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.id})
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {ADS_DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  size="sm"
                  variant={datePreset === preset.value ? 'primary' : 'secondary'}
                  onClick={() => setDatePreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {clientScope && clientScope.clients.length > 0 && current && (
              <select
                value={current.clientId ?? ''}
                onChange={(event) => void assign(event.target.value || null)}
                disabled={busy !== null}
                className="h-9 rounded-lg border border-[#DADCE0] bg-white px-3 text-sm"
                aria-label="Assigned client"
              >
                <option value="">Agency (no client)</option>
                {clientScope.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            )}
            {overview.data && (
              <span className="text-muted-foreground text-xs">
                {overview.data.since} → {overview.data.until}
              </span>
            )}
          </div>

          {overview.error && (
            <p
              role="alert"
              className="border-danger/40 bg-danger/10 text-danger rounded-xl border px-3 py-2.5 text-sm"
            >
              {overview.error.message}
            </p>
          )}
          {!overview.data && !overview.error && (
            <p className="text-muted-foreground text-sm">Loading live data from Google Ads…</p>
          )}
          {overview.data && (
            <>
              <Totals totals={overview.data.totals} currency={overview.data.account.currency} />
              <DailySpend daily={overview.data.daily} currency={overview.data.account.currency} />
              <EntityTable
                title="Campaigns"
                currency={overview.data.account.currency}
                rows={overview.data.campaigns.map((campaign) => ({
                  id: campaign.id,
                  name: campaign.name,
                  sub: [campaign.objective, campaign.budgetLabel].filter(Boolean).join(' · '),
                  status: campaign.status,
                  spend: campaign.spend,
                  clicks: campaign.clicks,
                  leads: campaign.leads,
                  costPerLead: campaign.costPerLead,
                }))}
              />
              <EntityTable
                title="Ad groups"
                currency={overview.data.account.currency}
                rows={overview.data.adGroups.map((group) => ({
                  id: group.id,
                  name: group.name,
                  sub: group.campaignName,
                  status: group.status,
                  spend: group.spend,
                  leads: group.leads,
                  costPerLead: group.costPerLead,
                }))}
              />
              <EntityTable
                title="Ads"
                currency={overview.data.account.currency}
                rows={overview.data.ads.map((ad) => ({
                  id: ad.id,
                  name: ad.name,
                  sub: ad.adsetName,
                  status: ad.status,
                  spend: ad.spend,
                  clicks: ad.clicks,
                  leads: ad.leads,
                  costPerLead: ad.costPerLead,
                }))}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
