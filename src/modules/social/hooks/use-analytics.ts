import type { Dayjs } from 'dayjs';
import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AnalyticsSummary } from '../types/analytics';
import { useClientScopeKey } from './use-client-scope';

export const ANALYTICS_API_ROUTE = '/api/social/analytics';

export function useAnalytics(range: { start: Dayjs; end: Dayjs }) {
  const scopeKey = useClientScopeKey();
  const params = new URLSearchParams({
    startDate: range.start.toISOString(),
    endDate: range.end.toISOString(),
  });
  const url = `${ANALYTICS_API_ROUTE}?${params}`;
  return useSWR<AnalyticsSummary>([url, scopeKey], ([path]) => fetcher(path), {
    keepPreviousData: true,
  });
}
