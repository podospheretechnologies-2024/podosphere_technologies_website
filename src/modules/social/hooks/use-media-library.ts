import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { MediaFormat, MediaPage } from '../types/media';

export const MEDIA_API_ROUTE = '/api/social/media';

export function useMediaLibrary(page: number, search: string, format?: MediaFormat) {
  const params = new URLSearchParams({ page: String(page) });
  if (search) {
    params.set('search', search);
  }
  if (format) {
    params.set('format', format);
  }

  return useSWR<MediaPage>(`${MEDIA_API_ROUTE}?${params}`, fetcher, {
    keepPreviousData: true,
  });
}
