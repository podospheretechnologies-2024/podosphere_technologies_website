import { apiFetch } from '@/shared/lib/fetcher';
import type {
  ConnectUrlResponse,
  GoogleSheetsContentMatch,
  GoogleSheetsStatusResponse,
  GoogleSpreadsheetItem,
} from '../types/google-sheets';

export const GOOGLE_SHEETS_API_ROUTE = '/api/social/google-sheets';

export async function startGoogleSheetsConnect(): Promise<void> {
  const { url } = await apiFetch<ConnectUrlResponse>(`${GOOGLE_SHEETS_API_ROUTE}/connect`);
  window.location.assign(url);
}

export function refreshGoogleSheets(): Promise<GoogleSheetsStatusResponse> {
  return apiFetch<GoogleSheetsStatusResponse>(`${GOOGLE_SHEETS_API_ROUTE}/refresh`, {
    method: 'POST',
  });
}

export function disconnectGoogleSheets(): Promise<void> {
  return apiFetch<void>(GOOGLE_SHEETS_API_ROUTE, { method: 'DELETE' });
}

export function fetchGoogleSheetsContent(date: string): Promise<GoogleSheetsContentMatch> {
  return apiFetch<GoogleSheetsContentMatch>(
    `${GOOGLE_SHEETS_API_ROUTE}/content?${new URLSearchParams({ date })}`
  );
}

export function fetchGoogleSpreadsheet(id: string): Promise<GoogleSpreadsheetItem> {
  return apiFetch<GoogleSpreadsheetItem>(`${GOOGLE_SHEETS_API_ROUTE}/spreadsheets/${id}`);
}
