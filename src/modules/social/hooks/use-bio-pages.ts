import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { BioPageItem } from '../types/bio';
import { useClientScopeKey } from './use-client-scope';

export const BIO_PAGES_API_ROUTE = '/api/social/bio-pages';

export function useBioPages() {
  const scopeKey = useClientScopeKey();
  return useSWR<BioPageItem[]>([BIO_PAGES_API_ROUTE, scopeKey], ([url]) => fetcher(url));
}
