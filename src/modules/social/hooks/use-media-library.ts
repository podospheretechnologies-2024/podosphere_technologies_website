import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { MediaFormat, MediaPage } from '../types/media';
import { useClientScopeKey } from './use-client-scope';

export const MEDIA_API_ROUTE = '/api/social/media';

export function useMediaLibrary(page: number, search: string, format?: MediaFormat) {
  const scopeKey = useClientScopeKey();
  const params = new URLSearchParams({ page: String(page) });
  if (search) {
    params.set('search', search);
  }
  if (format) {
    params.set('format', format);
  }

  const url = `${MEDIA_API_ROUTE}?${params}`;
  return useSWR<MediaPage>([url, scopeKey], ([path]) => fetcher(path), {
    keepPreviousData: true,
  });
}
