import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { AutopostItem, WebhookItem } from '../types/automation';
import type { GoogleSheetsStatusResponse } from '../types/google-sheets';
import { useClientScopeKey } from './use-client-scope';

export const WEBHOOKS_API_ROUTE = '/api/social/webhooks';
export const AUTOPOSTS_API_ROUTE = '/api/social/autoposts';
export const GOOGLE_SHEETS_API_ROUTE = '/api/social/google-sheets';

export function useWebhooks() {
  const scopeKey = useClientScopeKey();
  return useSWR<WebhookItem[]>([WEBHOOKS_API_ROUTE, scopeKey], ([url]) => fetcher(url));
}

export function useAutoposts() {
  const scopeKey = useClientScopeKey();
  return useSWR<AutopostItem[]>([AUTOPOSTS_API_ROUTE, scopeKey], ([url]) => fetcher(url));
}

export function useGoogleSheets(autoSync = true) {
  const scopeKey = useClientScopeKey();
  const url = autoSync ? `${GOOGLE_SHEETS_API_ROUTE}?autoSync=1` : GOOGLE_SHEETS_API_ROUTE;
  return useSWR<GoogleSheetsStatusResponse>([url, scopeKey], ([path]) => fetcher(path));
}
