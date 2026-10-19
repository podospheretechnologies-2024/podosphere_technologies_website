import useSWR from 'swr';
import { apiFetch, fetcher } from '@/shared/lib/fetcher';
import type { AdsOverviewDateInput } from './use-ads';
import type { GoogleAdsOverview, GoogleAdsStatusResponse } from '../types/google-ads';
import { useClientScopeKey } from './use-client-scope';

export const GOOGLE_ADS_API_ROUTE = '/api/social/ads/google';

export function useGoogleAdsStatus() {
  const scopeKey = useClientScopeKey();
  return useSWR<GoogleAdsStatusResponse>([GOOGLE_ADS_API_ROUTE, scopeKey], ([url]) => fetcher(url), {
    revalidateOnFocus: false,
  });
}

function dateQuery(date: AdsOverviewDateInput) {
  return date.mode === 'range'
    ? `since=${encodeURIComponent(date.since)}&until=${encodeURIComponent(date.until)}`
    : `datePreset=${encodeURIComponent(date.datePreset)}`;
}

export function useGoogleAdsOverview(accountId: string | null, date: AdsOverviewDateInput) {
  const scopeKey = useClientScopeKey();
  const url = accountId ? `${GOOGLE_ADS_API_ROUTE}/accounts/${accountId}?${dateQuery(date)}` : null;
  return useSWR<GoogleAdsOverview>(url ? [url, scopeKey] : null, ([path]) => fetcher(path), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export async function startGoogleAdsConnect(): Promise<void> {
  const { url } = await apiFetch<{ url: string }>(`${GOOGLE_ADS_API_ROUTE}/connect`);
  window.location.assign(url);
}

export function syncGoogleAdsAccounts(): Promise<void> {
  return apiFetch<void>(`${GOOGLE_ADS_API_ROUTE}/sync`, { method: 'POST' });
}

export function disconnectGoogleAds(): Promise<void> {
  return apiFetch<void>(GOOGLE_ADS_API_ROUTE, { method: 'DELETE' });
}

export function assignGoogleAdsAccount(accountId: string, clientId: string | null): Promise<void> {
  return apiFetch<void>(`${GOOGLE_ADS_API_ROUTE}/accounts/${accountId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });
}
