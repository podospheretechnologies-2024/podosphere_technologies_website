import { apiFetch } from '@/shared/lib/fetcher';
import type { CreateShortLinkInput, ShortLinkItem } from '../types/short-link';

export const SHORT_LINKS_API_ROUTE = '/api/social/short-links';

export function createShortLink(input: CreateShortLinkInput): Promise<ShortLinkItem> {
  return apiFetch<ShortLinkItem>(SHORT_LINKS_API_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
