import { apiFetch } from '@/shared/lib/fetcher';
import { WHATSAPP_API_ROUTE } from '../hooks/use-whatsapp';
import type { SendWhatsAppInput, SendWhatsAppResult } from '../types/whatsapp';

export function sendWhatsAppMessage(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  return apiFetch<SendWhatsAppResult>(`${WHATSAPP_API_ROUTE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
