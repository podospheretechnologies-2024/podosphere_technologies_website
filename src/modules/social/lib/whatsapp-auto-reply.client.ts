import { apiFetch } from '@/shared/lib/fetcher';
import { WHATSAPP_AUTO_REPLIES_API_ROUTE } from '../hooks/use-whatsapp-auto-replies';
import type {
  SaveWhatsAppAutoReplyInput,
  WhatsAppAutoReplyItem,
} from '../types/whatsapp-auto-reply';

function sendJson<T>(url: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function saveWhatsAppAutoReply(
  input: SaveWhatsAppAutoReplyInput,
  id?: string
): Promise<WhatsAppAutoReplyItem> {
  return id
    ? sendJson(`${WHATSAPP_AUTO_REPLIES_API_ROUTE}/${id}`, 'PUT', input)
    : sendJson(WHATSAPP_AUTO_REPLIES_API_ROUTE, 'POST', input);
}

export function deleteWhatsAppAutoReply(id: string): Promise<void> {
  return apiFetch<void>(`${WHATSAPP_AUTO_REPLIES_API_ROUTE}/${id}`, { method: 'DELETE' });
}
