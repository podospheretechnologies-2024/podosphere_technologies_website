import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { BestTimesResult } from '../types/analytics';
import { useClientScopeKey } from './use-client-scope';

export const BEST_TIMES_API_ROUTE = '/api/social/analytics/best-times';

export function useBestTimes(integrationId: string | null) {
  const scopeKey = useClientScopeKey();
  const url =
    integrationId && integrationId !== 'all'
      ? `${BEST_TIMES_API_ROUTE}?${new URLSearchParams({ integrationId })}`
      : null;
  return useSWR<BestTimesResult>(url ? [url, scopeKey] : null, ([path]) => fetcher(path), {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
}
