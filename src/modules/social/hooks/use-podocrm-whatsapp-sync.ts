'use client';

import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import { PODOCRM_WHATSAPP_SYNC_ROUTE } from '../lib/podocrm-whatsapp-sync.client';
import type { PodoCrmWhatsAppSyncStatus } from '../types/podocrm-whatsapp-sync';
import { useClientScopeKey } from './use-client-scope';

export function usePodoCrmWhatsAppSync() {
  const scopeKey = useClientScopeKey();
  return useSWR<PodoCrmWhatsAppSyncStatus>(
    [PODOCRM_WHATSAPP_SYNC_ROUTE, scopeKey],
    ([url]) => fetcher(url)
  );
}
