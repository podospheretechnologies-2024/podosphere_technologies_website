import type { Dayjs } from 'dayjs';
import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AnalyticsSummary } from '../types/analytics';

export const ANALYTICS_API_ROUTE = '/api/social/analytics';

export function useAnalytics(range: { start: Dayjs; end: Dayjs }) {
  const params = new URLSearchParams({
    startDate: range.start.toISOString(),
    endDate: range.end.toISOString(),
  });
  return useSWR<AnalyticsSummary>(`${ANALYTICS_API_ROUTE}?${params}`, fetcher, {
    keepPreviousData: true,
  });
}
