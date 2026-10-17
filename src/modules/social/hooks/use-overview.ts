import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AgencyOverview } from '../types/overview';
import { useClientScopeKey } from './use-client-scope';

export const OVERVIEW_API_ROUTE = '/api/social/overview';

export function useAgencyOverview() {
  const scopeKey = useClientScopeKey();
  return useSWR<AgencyOverview>([OVERVIEW_API_ROUTE, scopeKey], ([url]) => fetcher(url), {
    revalidateOnFocus: false,
  });
}
