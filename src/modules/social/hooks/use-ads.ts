import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AdsDatePreset } from '../config/ads';
import type { AdAccountItem, AdsEntityHistory, AdsOverview } from '../types/ads';

export const ADS_ACCOUNTS_API_ROUTE = '/api/social/ads/accounts';

export type AdsOverviewDateInput =
  | { mode: 'preset'; datePreset: AdsDatePreset }
  | { mode: 'range'; since: string; until: string };

export function useAdAccounts() {
  return useSWR<{ configured: boolean; accounts: AdAccountItem[] }>(ADS_ACCOUNTS_API_ROUTE, fetcher, {
    revalidateOnFocus: false,
  });
}

function overviewKey(accountId: string | null, date: AdsOverviewDateInput) {
  if (!accountId) return null;
  if (date.mode === 'range') {
    return `${ADS_ACCOUNTS_API_ROUTE}/${accountId}?since=${date.since}&until=${date.until}`;
  }
  return `${ADS_ACCOUNTS_API_ROUTE}/${accountId}?datePreset=${date.datePreset}`;
}

function dateQueryString(date: AdsOverviewDateInput) {
  if (date.mode === 'range') {
    return `since=${encodeURIComponent(date.since)}&until=${encodeURIComponent(date.until)}`;
  }
  return `datePreset=${encodeURIComponent(date.datePreset)}`;
}

export function useAdsOverview(accountId: string | null, date: AdsOverviewDateInput) {
  return useSWR<AdsOverview>(overviewKey(accountId, date), fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export function useAdsEntityHistory(
  accountId: string | null,
  kind: 'ad' | 'campaign' | 'adset' | null,
  entityId: string | null,
  date: AdsOverviewDateInput
) {
  const key =
    accountId && kind && entityId
      ? `${ADS_ACCOUNTS_API_ROUTE}/${accountId}/entities/${entityId}?kind=${kind}&${dateQueryString(date)}`
      : null;
  return useSWR<AdsEntityHistory>(key, fetcher, { revalidateOnFocus: false });
}
