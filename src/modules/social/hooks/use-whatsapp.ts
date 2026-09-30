import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { WhatsAppOverview } from '../types/whatsapp';

export const WHATSAPP_API_ROUTE = '/api/social/whatsapp';

export function useWhatsApp() {
  return useSWR<WhatsAppOverview>(WHATSAPP_API_ROUTE, fetcher, { revalidateOnFocus: false });
}
