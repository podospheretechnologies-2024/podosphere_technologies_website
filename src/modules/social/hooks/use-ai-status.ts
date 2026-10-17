import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AiStatus } from '../types/ai';
import { useClientScopeKey } from './use-client-scope';

export const AI_API_ROUTE = '/api/social/ai';

export function useAiStatus() {
  const scopeKey = useClientScopeKey();
  return useSWR<AiStatus>([AI_API_ROUTE, scopeKey], ([url]) => fetcher(url), {
    revalidateOnFocus: false,
  });
}
