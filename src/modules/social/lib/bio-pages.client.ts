import { apiFetch } from '@/shared/lib/fetcher';
import { BIO_PAGES_API_ROUTE } from '../hooks/use-bio-pages';
import type { BioPageItem, SaveBioPageInput } from '../types/bio';

/** Creates a bio page, or updates it when `id` is given. */
export function saveBioPage(input: SaveBioPageInput, id?: string): Promise<BioPageItem> {
  return apiFetch<BioPageItem>(id ? `${BIO_PAGES_API_ROUTE}/${id}` : BIO_PAGES_API_ROUTE, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteBioPage(id: string): Promise<void> {
  return apiFetch<void>(`${BIO_PAGES_API_ROUTE}/${id}`, { method: 'DELETE' });
}
