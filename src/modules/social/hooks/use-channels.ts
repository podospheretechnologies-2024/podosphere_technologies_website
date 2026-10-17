import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { ChannelsResponse } from '../types/integration';
import { useClientScopeKey } from './use-client-scope';

export const INTEGRATIONS_API_ROUTE = '/api/social/integrations';

export function useChannels() {
  const scopeKey = useClientScopeKey();
  return useSWR<ChannelsResponse>([INTEGRATIONS_API_ROUTE, scopeKey], ([url]) => fetcher(url));
}
