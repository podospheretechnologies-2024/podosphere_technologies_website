import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AutopostItem, WebhookItem } from '../types/automation';

export const WEBHOOKS_API_ROUTE = '/api/social/webhooks';
export const AUTOPOSTS_API_ROUTE = '/api/social/autoposts';

export function useWebhooks() {
  return useSWR<WebhookItem[]>(WEBHOOKS_API_ROUTE, fetcher);
}

export function useAutoposts() {
  return useSWR<AutopostItem[]>(AUTOPOSTS_API_ROUTE, fetcher);
}
