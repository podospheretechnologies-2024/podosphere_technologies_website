'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/shared/components/ui/empty-state';
import {
  ADS_DEFAULT_DATE_PRESET,
  ADS_DEFAULT_STATUS_FILTER,
  type AdsDatePreset,
  type AdsStatusFilter,
} from '../../config/ads';
import {
  confirmMetaAdsConnect,
  disconnectMetaAdAccount,
  fetchMetaAdsPending,
  startMetaAdsConnect,
  useAdAccounts,
  useAdsOverview,
  type AdsOverviewDateInput,
} from '../../hooks/use-ads';
import type { AdAccountItem } from '../../types/ads';
import { AdsDetailPanel, type AdsDetailSelection } from './ads-detail-panel';
import { AdsManager } from './ads-manager';
import { GoogleAdsPanel } from './google-ads-panel';

function preferredAccount(accounts: AdAccountItem[]): string | null {
  const own = accounts.find((account) => /podosphere/i.test(account.name));
  return (own ?? accounts[0])?.id ?? null;
}

type PendingAccount = {
  id: string;
  name: string;
  currency: string;
  accountStatus: number;
  businessName?: string | null;
};

function MetaAdsAccountPicker({
  accounts,
  onSaved,
  onCancel,
}: {
  accounts: PendingAccount[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(accounts.map((a) => a.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    try {
      setBusy(true);
      setError(null);
      await confirmMetaAdsConnect([...selected]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save ad accounts');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="meta-ads-pick-title"
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="meta-ads-pick-title" className="text-lg font-semibold text-[#1C1E21]">
          Choose ad accounts
        </h2>
        <p className="mt-1 text-sm text-[#606770]">
          Only the accounts you tick are saved to this workspace. Sync will not overwrite their
          Facebook Login tokens.
        </p>
        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {accounts.map((account) => (
            <li key={account.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#DADCE0] px-3 py-2 hover:bg-[#F0F2F5]">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(account.id)}
                  onChange={() => toggle(account.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[#1C1E21]">
                    {account.name}
                  </span>
                  <span className="block text-xs text-[#606770]">
                    {account.id}
                    {account.businessName ? ` · ${account.businessName}` : ''} · {account.currency}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="mt-3 text-sm text-[#DC2626]">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[#DADCE0] bg-white px-3 py-1.5 text-sm font-medium text-[#1C1E21] hover:bg-[#F0F2F5] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || selected.size === 0}
            className="rounded-md bg-[#1877F2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#166FE5] disabled:opacity-50"
          >
            {busy ? 'Saving…' : `Save ${selected.size} account${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaAdsDashboard() {
  const accountsQuery = useAdAccounts();
  const [selected, setSelected] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<AdsDatePreset>(ADS_DEFAULT_DATE_PRESET);
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdsStatusFilter>(ADS_DEFAULT_STATUS_FILTER);
  const [detail, setDetail] = useState<AdsDetailSelection | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const accounts = accountsQuery.data?.accounts ?? [];
  const accountId = selected ?? preferredAccount(accounts);
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const oauthConfigured = Boolean(accountsQuery.data?.oauthConfigured);

  const customRangeReady = Boolean(since && until && since <= until);
  const dateQuery: AdsOverviewDateInput = customRangeReady
    ? { mode: 'range', since, until }
    : { mode: 'preset', datePreset };
  const overview = useAdsOverview(accountId, dateQuery);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      setBanner(error);
    }
    if (params.get('metaAds') !== 'pick') return;

    void fetchMetaAdsPending()
      .then((pending) => {
        if (pending?.accounts.length) setPendingAccounts(pending.accounts);
        else setBanner('No pending ad accounts to pick. Try Connect again.');
      })
      .catch((err) => {
        setBanner(err instanceof Error ? err.message : 'Could not load pending ad accounts');
      });

    params.delete('metaAds');
    params.delete('error');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
  }, []);

  function selectPreset(value: AdsDatePreset) {
    setDatePreset(value);
    setSince('');
    setUntil('');
  }

  async function connectAdAccount() {
    try {
      setConnectBusy(true);
      setBanner(null);
      await startMetaAdsConnect();
    } catch (error) {
      setBanner(error instanceof Error ? error.message : 'Could not start Meta Ads connect');
      setConnectBusy(false);
    }
  }

  async function disconnectSelected() {
    if (!accountId) return;
    if (!window.confirm('Disconnect this ad account token? Campaign data will stop syncing until you reconnect.')) {
      return;
    }
    try {
      setConnectBusy(true);
      await disconnectMetaAdAccount(accountId);
      await accountsQuery.mutate();
      setBanner('Ad account disconnected.');
    } catch (error) {
      setBanner(error instanceof Error ? error.message : 'Could not disconnect');
    } finally {
      setConnectBusy(false);
    }
  }

  if (accountsQuery.isLoading) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3rem)] items-center justify-center bg-[#F0F2F5] text-sm text-[#606770]">
        Loading ad accounts…
      </div>
    );
  }
  if (accountsQuery.error) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3rem)] items-center justify-center bg-[#F0F2F5] p-6 text-sm text-[#DC2626]">
        {accountsQuery.error.message}
      </div>
    );
  }

  async function syncAccounts() {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/social/ads/accounts/sync', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Sync failed (${res.status})`);
      }
      await accountsQuery.mutate();
      await overview.mutate();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }

  const needsReconnect =
    Boolean(selectedAccount?.refreshNeeded) ||
    (Boolean(overview.error?.message) &&
      /expired or revoked|Reconnect the ad account|no meta token stored/i.test(
        overview.error?.message ?? ''
      ));

  const connectButton = oauthConfigured ? (
    <button
      type="button"
      disabled={connectBusy}
      onClick={() => void connectAdAccount()}
      className="rounded-md bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#166FE5] disabled:opacity-50"
    >
      {connectBusy ? 'Opening Facebook…' : 'Connect ad account'}
    </button>
  ) : null;

  if (!accountsQuery.data?.configured && accounts.length === 0) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3rem)] bg-[#F0F2F5] p-6">
        {pendingAccounts && (
          <MetaAdsAccountPicker
            accounts={pendingAccounts}
            onSaved={async () => {
              setPendingAccounts(null);
              await accountsQuery.mutate();
              setBanner('Ad accounts connected.');
            }}
            onCancel={() => setPendingAccounts(null)}
          />
        )}
        {banner && (
          <p className="mb-4 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#DC2626]">
            {banner}
          </p>
        )}
        <EmptyState
          title="Ads are not connected yet"
          description={
            oauthConfigured
              ? 'Connect your Meta ad account with Facebook Login to view campaigns and insights for this workspace only.'
              : 'Create a system user in Meta Business Manager with ads_read on your ad accounts, then set META_SYSTEM_USER_TOKEN on the server — or set META_APP_ID and META_APP_SECRET to enable Connect ad account.'
          }
        />
        {connectButton && <div className="mt-6 flex justify-center">{connectButton}</div>}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center bg-[#F0F2F5] p-6">
        {pendingAccounts && (
          <MetaAdsAccountPicker
            accounts={pendingAccounts}
            onSaved={async () => {
              setPendingAccounts(null);
              await accountsQuery.mutate();
              setBanner('Ad accounts connected.');
            }}
            onCancel={() => setPendingAccounts(null)}
          />
        )}
        {banner && (
          <p className="mb-4 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#DC2626]">
            {banner}
          </p>
        )}
        <EmptyState
          title="No ad accounts assigned"
          description="Connect an ad account with Facebook Login, or ask an admin to assign one. Only accounts for this organization and client appear here."
        />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {connectButton}
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => void syncAccounts()}
            className="rounded-md border border-[#DADCE0] bg-white px-4 py-2 text-sm font-semibold text-[#1C1E21] shadow-sm hover:bg-[#F0F2F5] disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Ad Accounts from Meta'}
          </button>
        </div>
      </div>
    );
  }

  const detailLeads =
    detail?.kind === 'ad' && overview.data
      ? overview.data.leads.filter((lead) => lead.adId === detail.ad.id)
      : [];

  return (
    <div className="-m-5 flex min-h-[calc(100vh-3rem)] flex-col bg-[#F0F2F5]">
      {pendingAccounts && (
        <MetaAdsAccountPicker
          accounts={pendingAccounts}
          onSaved={async () => {
            setPendingAccounts(null);
            await accountsQuery.mutate();
            setBanner('Ad accounts connected.');
          }}
          onCancel={() => setPendingAccounts(null)}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADCE0] bg-white px-4 py-2">
        <p className="text-xs text-[#606770]">
          Accounts are scoped to this organization
          {selectedAccount?.refreshNeeded ? ' · Token needs reconnect' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {needsReconnect && oauthConfigured && (
            <button
              type="button"
              disabled={connectBusy}
              onClick={() => void connectAdAccount()}
              className="rounded-md bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
            >
              Reconnect
            </button>
          )}
          {oauthConfigured && (
            <button
              type="button"
              disabled={connectBusy}
              onClick={() => void connectAdAccount()}
              className="rounded-md bg-[#1877F2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#166FE5] disabled:opacity-50"
            >
              {connectBusy ? 'Opening…' : 'Connect ad account'}
            </button>
          )}
          {selectedAccount?.hasToken && (
            <button
              type="button"
              disabled={connectBusy}
              onClick={() => void disconnectSelected()}
              className="rounded-md border border-[#DADCE0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1C1E21] hover:bg-[#F0F2F5] disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
      {banner && (
        <div className="border-b border-[#DADCE0] bg-[#F0F2F5] px-4 py-2 text-sm text-[#1C1E21]">
          {banner}
        </div>
      )}
      {overview.error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-sm text-[#DC2626]">
          <p className="min-w-0 flex-1">{overview.error.message}</p>
          {needsReconnect && oauthConfigured ? (
            <button
              type="button"
              disabled={connectBusy}
              onClick={() => void connectAdAccount()}
              className="shrink-0 rounded-md bg-[#1877F2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#166FE5] disabled:opacity-50"
            >
              {connectBusy ? 'Opening…' : 'Reconnect'}
            </button>
          ) : (
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void syncAccounts()}
              className="shrink-0 rounded-md bg-[#1877F2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#166FE5] disabled:opacity-50"
            >
              {isSyncing ? 'Syncing…' : 'Sync tokens from Meta'}
            </button>
          )}
        </div>
      )}
      {!overview.data && !overview.error && (
        <div className="flex flex-1 items-center justify-center text-sm text-[#606770]">
          Loading live data from Meta…
        </div>
      )}
      {overview.data && (
        <AdsManager
          key={overview.data.account.id}
          data={overview.data}
          accounts={accounts}
          accountId={accountId ?? overview.data.account.id}
          onAccountChange={setSelected}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          datePreset={datePreset}
          since={since}
          until={until}
          onSelectPreset={selectPreset}
          onSince={setSince}
          onUntil={setUntil}
          onSelectDetail={setDetail}
          onRefresh={() => void overview.mutate()}
          isRefreshing={overview.isValidating}
        />
      )}

      {detail && accountId && overview.data && (
        <AdsDetailPanel
          selection={detail}
          currency={overview.data.account.currency}
          accountId={accountId}
          date={dateQuery}
          relatedLeads={detailLeads}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

type AdsPlatform = 'meta' | 'google';

const BASE_PLATFORMS: { value: AdsPlatform; label: string }[] = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
];

export function AdsDashboard() {
  const [platform, setPlatform] = useState<AdsPlatform>('meta');
  const platforms = BASE_PLATFORMS;

  // OAuth callbacks return with ?platform=meta|google.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('platform');
    if (value === 'google' || value === 'meta') setPlatform(value);
  }, []);

  return (
    <div className="-m-5 bg-[#F0F2F5]">
      <div
        role="tablist"
        aria-label="Ad platform"
        className="flex gap-1 border-b border-[#DADCE0] bg-white px-5 pt-2"
      >
        {platforms.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={platform === item.value}
            onClick={() => setPlatform(item.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              platform === item.value
                ? 'border-[#1877F2] text-[#1877F2]'
                : 'border-transparent text-[#606770] hover:text-[#1C1E21]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="p-5">
        {platform === 'meta' ? <MetaAdsDashboard /> : <GoogleAdsPanel />}
      </div>
    </div>
  );
}
