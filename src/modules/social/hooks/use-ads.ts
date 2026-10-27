import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AdsDatePreset } from '../config/ads';
import type {
  AdAccountItem,
  AdsAudienceItem,
  AdsCatalogsResult,
  AdsEntityHistory,
  AdsOverview,
  AdsReportBreakdown,
  AdsReportLevel,
  AdsReportResult,
} from '../types/ads';
import { useClientScopeKey } from './use-client-scope';

export const ADS_ACCOUNTS_API_ROUTE = '/api/social/ads/accounts';

export type AdsOverviewDateInput =
  | { mode: 'preset'; datePreset: AdsDatePreset }
  | { mode: 'range'; since: string; until: string };

export function useAdAccounts() {
  const scopeKey = useClientScopeKey();
  return useSWR<{ configured: boolean; accounts: AdAccountItem[] }>(
    [ADS_ACCOUNTS_API_ROUTE, scopeKey],
    ([url]) => fetcher(url),
    { revalidateOnFocus: false }
  );
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
  const scopeKey = useClientScopeKey();
  const url = overviewKey(accountId, date);
  return useSWR<AdsOverview>(url ? [url, scopeKey] : null, ([path]) => fetcher(path), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export function useAdAudiences(accountId: string | null) {
  const scopeKey = useClientScopeKey();
  const url = accountId ? `${ADS_ACCOUNTS_API_ROUTE}/${accountId}/audiences` : null;
  return useSWR<{ audiences: AdsAudienceItem[] }>(
    url ? [url, scopeKey] : null,
    ([path]) => fetcher(path),
    { revalidateOnFocus: false }
  );
}

export function useAdCatalogs(accountId: string | null) {
  const scopeKey = useClientScopeKey();
  const url = accountId ? `${ADS_ACCOUNTS_API_ROUTE}/${accountId}/catalogs` : null;
  return useSWR<AdsCatalogsResult>(url ? [url, scopeKey] : null, ([path]) => fetcher(path), {
    revalidateOnFocus: false,
  });
}

export function useAdsReport(
  accountId: string | null,
  date: AdsOverviewDateInput,
  level: AdsReportLevel,
  breakdown: AdsReportBreakdown,
  compare: boolean
) {
  const scopeKey = useClientScopeKey();
  const url = accountId
    ? `${ADS_ACCOUNTS_API_ROUTE}/${accountId}/report?${dateQueryString(date)}&level=${level}&breakdown=${breakdown}&compare=${compare ? '1' : '0'}`
    : null;
  return useSWR<AdsReportResult>(url ? [url, scopeKey] : null, ([path]) => fetcher(path), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export async function setAdsEntityStatus(
  accountId: string,
  kind: 'ad' | 'campaign' | 'adset',
  ids: string[],
  status: 'ACTIVE' | 'PAUSED'
) {
  const res = await fetch(`${ADS_ACCOUNTS_API_ROUTE}/${accountId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, ids, status }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    updated?: string[];
    failed?: { id: string; error: string }[];
  };
  if (!res.ok) {
    throw new Error(json.error ?? 'Could not update ad status');
  }
  return { updated: json.updated ?? [], failed: json.failed ?? [] };
}

export function useAdsEntityHistory(
  accountId: string | null,
  kind: 'ad' | 'campaign' | 'adset' | null,
  entityId: string | null,
  date: AdsOverviewDateInput
) {
  const scopeKey = useClientScopeKey();
  const url =
    accountId && kind && entityId
      ? `${ADS_ACCOUNTS_API_ROUTE}/${accountId}/entities/${entityId}?kind=${kind}&${dateQueryString(date)}`
      : null;
  return useSWR<AdsEntityHistory>(url ? [url, scopeKey] : null, ([path]) => fetcher(path), {
    revalidateOnFocus: false,
  });
}
