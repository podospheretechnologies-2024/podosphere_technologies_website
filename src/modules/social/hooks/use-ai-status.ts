import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AiStatus } from '../types/ai';

export const AI_API_ROUTE = '/api/social/ai';

export function useAiStatus() {
  return useSWR<AiStatus>(AI_API_ROUTE, fetcher, { revalidateOnFocus: false });
}
