import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AdsDatePreset } from '../config/ads';
import type { AdAccountItem, AdsOverview } from '../types/ads';

export const ADS_ACCOUNTS_API_ROUTE = '/api/social/ads/accounts';

export function useAdAccounts() {
  return useSWR<{ configured: boolean; accounts: AdAccountItem[] }>(ADS_ACCOUNTS_API_ROUTE, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useAdsOverview(accountId: string | null, datePreset: AdsDatePreset) {
  return useSWR<AdsOverview>(
    accountId ? `${ADS_ACCOUNTS_API_ROUTE}/${accountId}?datePreset=${datePreset}` : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
}
