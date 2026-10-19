import { apiFetch } from '@/shared/lib/fetcher';
import { CSV_IMPORT_DEFAULT_TIMEZONE } from '../config/csv-import';
import type {
  CsvImportCreateResponse,
  CsvImportCreateRow,
  CsvImportPreviewResponse,
} from '../types/csv-import';

const CSV_PREVIEW_ROUTE = '/api/social/posts/csv/preview';
const CSV_CREATE_ROUTE = '/api/social/posts/csv';

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || CSV_IMPORT_DEFAULT_TIMEZONE;
  } catch {
    return CSV_IMPORT_DEFAULT_TIMEZONE;
  }
}

export async function previewCsvImport(
  file: File,
  timeZone: string = browserTimeZone()
): Promise<CsvImportPreviewResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('timeZone', timeZone);
  return apiFetch<CsvImportPreviewResponse>(CSV_PREVIEW_ROUTE, {
    method: 'POST',
    body: form,
  });
}

export async function createCsvImport(
  rows: CsvImportCreateRow[],
  timeZone: string = browserTimeZone()
): Promise<CsvImportCreateResponse> {
  return apiFetch<CsvImportCreateResponse>(CSV_CREATE_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, timeZone }),
  });
}

export const CSV_TEMPLATE = `date,time,channels,text,media_url
2026-11-01,09:30,"instagram,facebook","Hello from bulk schedule!",https://example.com/image.jpg
2026-11-02,18:00,linkedin,"LinkedIn-only post without media",
`;
