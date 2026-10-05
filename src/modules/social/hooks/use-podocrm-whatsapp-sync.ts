'use client';

import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import { PODOCRM_WHATSAPP_SYNC_ROUTE } from '../lib/podocrm-whatsapp-sync.client';
import type { PodoCrmWhatsAppSyncStatus } from '../types/podocrm-whatsapp-sync';

export function usePodoCrmWhatsAppSync() {
  return useSWR<PodoCrmWhatsAppSyncStatus>(PODOCRM_WHATSAPP_SYNC_ROUTE, fetcher);
}
