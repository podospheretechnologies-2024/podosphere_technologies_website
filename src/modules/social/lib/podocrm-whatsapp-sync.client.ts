import { apiFetch } from '@/shared/lib/fetcher';
import type {
  PodoCrmWhatsAppLinkResult,
  PodoCrmWhatsAppSyncStatus,
} from '../types/podocrm-whatsapp-sync';

export const PODOCRM_WHATSAPP_SYNC_ROUTE = '/api/social/podocrm-whatsapp-sync';

export function getPodoCrmWhatsAppSyncStatus() {
  return apiFetch<PodoCrmWhatsAppSyncStatus>(PODOCRM_WHATSAPP_SYNC_ROUTE);
}

export function linkPodoCrmWhatsApp(code: string) {
  return apiFetch<PodoCrmWhatsAppLinkResult>(PODOCRM_WHATSAPP_SYNC_ROUTE, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function unlinkPodoCrmWhatsApp() {
  return apiFetch<void>(PODOCRM_WHATSAPP_SYNC_ROUTE, { method: 'DELETE' });
}
