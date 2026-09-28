import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { ChannelsResponse } from '../types/integration';

export const INTEGRATIONS_API_ROUTE = '/api/social/integrations';

export function useChannels() {
  return useSWR<ChannelsResponse>(INTEGRATIONS_API_ROUTE, fetcher);
}
