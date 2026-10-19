import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { WhatsAppAutoReplyItem } from '../types/whatsapp-auto-reply';
import { useClientScopeKey } from './use-client-scope';

export const WHATSAPP_AUTO_REPLIES_API_ROUTE = '/api/social/whatsapp/auto-replies';

export function useWhatsAppAutoReplies() {
  const scopeKey = useClientScopeKey();
  return useSWR<WhatsAppAutoReplyItem[]>([WHATSAPP_AUTO_REPLIES_API_ROUTE, scopeKey], ([url]) =>
    fetcher(url)
  );
}
