'use client';

import { useEffect, useMemo, useState } from 'react';
import { MarketplaceOverviewPanel, MarketplaceSamplePanel } from '@/modules/admin/components/marketplace-ads-dashboard';
import { marketplaceClientsFor, type MarketplaceId } from '@/modules/admin/data/marketplace-ads.sample';
import { EmptyState } from '@/shared/components/ui/empty-state';
import {
  ADS_DEFAULT_DATE_PRESET,
  ADS_DEFAULT_STATUS_FILTER,
  type AdsDatePreset,
  type AdsStatusFilter,
} from '../../config/ads';
import { useAdAccounts, useAdsOverview, type AdsOverviewDateInput } from '../../hooks/use-ads';
import type { AdAccountItem } from '../../types/ads';
import { AdsDetailPanel, type AdsDetailSelection } from './ads-detail-panel';
import { AdsManager } from './ads-manager';
import { GoogleAdsPanel } from './google-ads-panel';

function preferredAccount(accounts: AdAccountItem[]): string | null {
  const own = accounts.find((account) => /podosphere/i.test(account.name));
  return (own ?? accounts[0])?.id ?? null;
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
  const accounts = accountsQuery.data?.accounts ?? [];
  const accountId = selected ?? preferredAccount(accounts);

  const customRangeReady = Boolean(since && until && since <= until);
  const dateQuery: AdsOverviewDateInput = customRangeReady
    ? { mode: 'range', since, until }
    : { mode: 'preset', datePreset };
  const overview = useAdsOverview(accountId, dateQuery);

  function selectPreset(value: AdsDatePreset) {
    setDatePreset(value);
    setSince('');
    setUntil('');
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
  if (!accountsQuery.data?.configured) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3rem)] bg-[#F0F2F5] p-6">
        <EmptyState
          title="Ads are not connected yet"
          description="Create a system user in Meta Business Manager with ads_read on your ad accounts, then set META_SYSTEM_USER_TOKEN on the server."
        />
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

  const needsTokenSync =
    Boolean(overview.error?.message) &&
    /no meta token stored|META_SYSTEM_USER_TOKEN/i.test(overview.error?.message ?? '');

  if (accounts.length === 0) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3rem)] bg-[#F0F2F5] p-6 flex flex-col items-center justify-center">
        <EmptyState
          title="No ad accounts assigned"
          description="Only ad accounts assigned to this organization or client appear here. Ask an admin to assign an account, or sync from Meta if you manage the agency workspace."
        />
        <button
          type="button"
          disabled={isSyncing}
          onClick={syncAccounts}
          className="mt-6 rounded-md bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#166FE5] disabled:opacity-50"
        >
          {isSyncing ? 'Syncing...' : 'Sync Ad Accounts from Meta'}
        </button>
      </div>
    );
  }

  const detailLeads =
    detail?.kind === 'ad' && overview.data
      ? overview.data.leads.filter((lead) => lead.adId === detail.ad.id)
      : [];

  return (
    <div className="-m-5 flex min-h-[calc(100vh-3rem)] flex-col bg-[#F0F2F5]">
      {overview.error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-sm text-[#DC2626]">
          <p className="min-w-0 flex-1">{overview.error.message}</p>
          {needsTokenSync && (
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

type SampleMarketplace = Exclude<MarketplaceId, 'meta'>;
type AdsPlatform = 'dashboard' | 'meta' | 'google' | SampleMarketplace;

const BASE_PLATFORMS: { value: AdsPlatform; label: string }[] = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
];

// Sample-data tabs, shown to platform admins only.
const ADMIN_DASHBOARD_TAB: { value: AdsPlatform; label: string } = { value: 'dashboard', label: 'Dashboard' };

const ADMIN_SAMPLE_PLATFORMS: { value: AdsPlatform; label: string }[] = [
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'meesho', label: 'Meesho' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'amazon', label: 'Amazon' },
];

export function AdsDashboard({ isPlatformAdmin = false }: { isPlatformAdmin?: boolean }) {
  const [platform, setPlatform] = useState<AdsPlatform>('meta');
  const accountsQuery = useAdAccounts();
  // Each platform lists its own clients; names come from the connected Meta ad accounts when they match.
  const accountRows = useMemo(
    () =>
      (accountsQuery.data?.accounts ?? []).map((account) => ({
        id: account.id,
        name: account.name,
        organizationName: 'Meta ad account',
        isDemo: false,
      })),
    [accountsQuery.data],
  );
  const platforms = isPlatformAdmin
    ? [ADMIN_DASHBOARD_TAB, ...BASE_PLATFORMS, ...ADMIN_SAMPLE_PLATFORMS]
    : BASE_PLATFORMS;

  // The Google OAuth callback returns to ?platform=google.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('platform') === 'google') {
      setPlatform('google');
    }
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
        {platform === 'dashboard' ? (
          <MarketplaceOverviewPanel onSelectPlatform={setPlatform} />
        ) : platform === 'meta' ? (
          <MetaAdsDashboard />
        ) : platform === 'google' ? (
          isPlatformAdmin ? (
            <MarketplaceSamplePanel key="google" marketplace="google" clients={marketplaceClientsFor('google', accountRows)} />
          ) : (
            <GoogleAdsPanel />
          )
        ) : (
          <MarketplaceSamplePanel
            key={platform}
            marketplace={platform}
            clients={marketplaceClientsFor(platform, accountRows)}
          />
        )}
      </div>
    </div>
  );
}
