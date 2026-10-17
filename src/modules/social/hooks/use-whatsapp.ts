import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { WhatsAppOverview } from '../types/whatsapp';
import { useClientScopeKey } from './use-client-scope';

export const WHATSAPP_API_ROUTE = '/api/social/whatsapp';

export function useWhatsApp() {
  const scopeKey = useClientScopeKey();
  return useSWR<WhatsAppOverview>([WHATSAPP_API_ROUTE, scopeKey], ([url]) => fetcher(url), {
    revalidateOnFocus: false,
  });
}
