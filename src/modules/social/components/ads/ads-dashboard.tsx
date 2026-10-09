'use client';

import { useState } from 'react';
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

function preferredAccount(accounts: AdAccountItem[]): string | null {
  const own = accounts.find((account) => /podosphere/i.test(account.name));
  return (own ?? accounts[0])?.id ?? null;
}

export function AdsDashboard() {
  const accountsQuery = useAdAccounts();
  const [selected, setSelected] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<AdsDatePreset>(ADS_DEFAULT_DATE_PRESET);
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdsStatusFilter>(ADS_DEFAULT_STATUS_FILTER);
  const [detail, setDetail] = useState<AdsDetailSelection | null>(null);

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
  const [isSyncing, setIsSyncing] = useState(false);

  async function syncAccounts() {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/social/ads/accounts/sync', { method: 'POST' });
      if (res.ok) {
        await accountsQuery.mutate();
      }
    } finally {
      setIsSyncing(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3rem)] bg-[#F0F2F5] p-6 flex flex-col items-center justify-center">
        <EmptyState
          title="No ad accounts shared"
          description="In Business Manager → System users → podo-social-bot → Assign assets, add the ad accounts you want to see here."
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
        <div className="border-b border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-sm text-[#DC2626]">
          {overview.error.message}
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
