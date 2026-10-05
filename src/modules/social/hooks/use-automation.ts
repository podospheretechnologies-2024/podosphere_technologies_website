import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AutopostItem, WebhookItem } from '../types/automation';
import type { GoogleSheetsStatusResponse } from '../types/google-sheets';

export const WEBHOOKS_API_ROUTE = '/api/social/webhooks';
export const AUTOPOSTS_API_ROUTE = '/api/social/autoposts';
export const GOOGLE_SHEETS_API_ROUTE = '/api/social/google-sheets';

export function useWebhooks() {
  return useSWR<WebhookItem[]>(WEBHOOKS_API_ROUTE, fetcher);
}

export function useAutoposts() {
  return useSWR<AutopostItem[]>(AUTOPOSTS_API_ROUTE, fetcher);
}

export function useGoogleSheets(autoSync = true) {
  const url = autoSync ? `${GOOGLE_SHEETS_API_ROUTE}?autoSync=1` : GOOGLE_SHEETS_API_ROUTE;
  return useSWR<GoogleSheetsStatusResponse>(url, fetcher);
}
