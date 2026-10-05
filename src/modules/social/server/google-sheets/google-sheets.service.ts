import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import type {
  GoogleSheetRow,
  GoogleSheetsContentMatch,
  GoogleSheetsStatusResponse,
  GoogleSpreadsheetItem,
} from '../../types/google-sheets';
import { googleSheetsOAuthState } from './google-sheets-oauth-state';
import { googleSheetsRepository } from './google-sheets.repository';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

const MAX_ROWS_PER_SHEET = 2000;
const AUTO_SYNC_MS = 15 * 60 * 1000;

const DATE_HEADER_HINTS = [
  'date',
  'post date',
  'posting date',
  'scheduled',
  'schedule',
  'publish date',
  'day',
  'when',
];
const CONTENT_HEADER_HINTS = [
  'content',
  'caption',
  'post',
  'text',
  'message',
  'description',
  'body',
  'copy',
  'headline',
  'title',
];

function isConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getGoogleEnv(name: 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(400, 'Google Sheets is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.');
  }
  return value;
}

function redirectUri(): string {
  return new URL('/api/social/google-sheets/callback', getServerEnv().APP_URL).toString();
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickHeaderIndex(headers: string[], hints: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const hint of hints) {
    const exact = normalized.findIndex((h) => h === hint);
    if (exact >= 0) return exact;
  }
  for (const hint of hints) {
    const partial = normalized.findIndex((h) => h.includes(hint));
    if (partial >= 0) return partial;
  }
  return -1;
}

function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // Excel serial date (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial > 20000 && serial < 80000) {
      const utc = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
      return new Date(utc).toISOString().slice(0, 10);
    }
  }

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

function rowFromValues(
  sheetName: string,
  rowIndex: number,
  headers: string[],
  cells: string[]
): GoogleSheetRow {
  const values: Record<string, string> = {};
  headers.forEach((header, index) => {
    const key = header || `Column ${index + 1}`;
    values[key] = cells[index] ?? '';
  });

  const dateIdx = pickHeaderIndex(headers, DATE_HEADER_HINTS);
  const contentIdx = pickHeaderIndex(headers, CONTENT_HEADER_HINTS);
  const dateRaw = dateIdx >= 0 ? (cells[dateIdx] ?? '') : '';
  let content =
    contentIdx >= 0
      ? (cells[contentIdx] ?? '').trim()
      : cells.find((cell, index) => index !== dateIdx && cell.trim())?.trim() || '';

  if (!content) {
    content = Object.entries(values)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }

  return {
    sheetName,
    rowIndex,
    values,
    dateValue: parseFlexibleDate(dateRaw),
    content,
  };
}

function parseRowsJson(raw: Prisma.JsonValue): GoogleSheetRow[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as GoogleSheetRow[];
}

function parseStringArray(raw: Prisma.JsonValue): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item));
}

function toSpreadsheetItem(row: {
  id: string;
  spreadsheetId: string;
  name: string;
  url: string;
  modifiedTime: Date | null;
  sheetNames: Prisma.JsonValue;
  headers: Prisma.JsonValue;
  rows: Prisma.JsonValue;
  rowCount: number;
  syncedAt: Date;
}): GoogleSpreadsheetItem {
  return {
    id: row.id,
    spreadsheetId: row.spreadsheetId,
    name: row.name,
    url: row.url,
    modifiedTime: row.modifiedTime?.toISOString() ?? null,
    sheetNames: parseStringArray(row.sheetNames),
    headers: parseStringArray(row.headers),
    rowCount: row.rowCount,
    syncedAt: row.syncedAt.toISOString(),
    rows: parseRowsJson(row.rows),
  };
}

async function googleFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new HttpError(
      response.status === 401 ? 401 : 502,
      `Google API error (${response.status}): ${text.slice(0, 240) || response.statusText}`
    );
  }
  return (await response.json()) as T;
}

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: getGoogleEnv('GOOGLE_CLIENT_ID'),
    client_secret: getGoogleEnv('GOOGLE_CLIENT_SECRET'),
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new HttpError(400, 'Could not exchange Google authorization code');
  }
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: getGoogleEnv('GOOGLE_CLIENT_ID'),
    client_secret: getGoogleEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new HttpError(401, 'Google session expired. Please connect Google Sheets again.');
  }
  return (await response.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
  };
}

async function getValidAccessToken(organizationId: string): Promise<string> {
  const connection = await googleSheetsRepository.findConnectionOnly(organizationId);
  if (!connection) {
    throw new HttpError(404, 'Google Sheets is not connected');
  }

  const expiresSoon =
    connection.tokenExpiration &&
    connection.tokenExpiration.getTime() < Date.now() + 60_000;

  if (!expiresSoon) {
    return decrypt(connection.accessToken);
  }

  if (!connection.refreshToken) {
    throw new HttpError(401, 'Google session expired. Please connect Google Sheets again.');
  }

  const refreshed = await refreshAccessToken(decrypt(connection.refreshToken));
  await googleSheetsRepository.updateTokens(organizationId, {
    accessToken: encrypt(refreshed.access_token),
    refreshToken: connection.refreshToken,
    tokenExpiration: refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null,
  });
  return refreshed.access_token;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

async function listAllSpreadsheets(accessToken: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'nextPageToken, files(id, name, modifiedTime, webViewLink)',
      pageSize: '100',
      orderBy: 'modifiedTime desc',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await googleFetch<{ files?: DriveFile[]; nextPageToken?: string }>(
      `${DRIVE_FILES_URL}?${params}`,
      accessToken
    );
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

async function fetchSpreadsheetRows(
  accessToken: string,
  spreadsheetId: string
): Promise<{ sheetNames: string[]; headers: string[]; rows: GoogleSheetRow[] }> {
  const meta = await googleFetch<{
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`, accessToken);

  const sheetNames = (meta.sheets ?? [])
    .map((sheet) => sheet.properties?.title?.trim())
    .filter((title): title is string => Boolean(title));

  if (sheetNames.length === 0) {
    return { sheetNames: [], headers: [], rows: [] };
  }

  const ranges = sheetNames.map((name) => `'${name.replace(/'/g, "''")}'!A1:ZZ${MAX_ROWS_PER_SHEET}`);
  const params = new URLSearchParams();
  for (const range of ranges) params.append('ranges', range);
  params.set('majorDimension', 'ROWS');
  params.set('valueRenderOption', 'FORMATTED_VALUE');

  const batch = await googleFetch<{
    valueRanges?: Array<{ range?: string; values?: string[][] }>;
  }>(`${SHEETS_API}/${spreadsheetId}/values:batchGet?${params}`, accessToken);

  const allRows: GoogleSheetRow[] = [];
  const headersSet = new Set<string>();

  (batch.valueRanges ?? []).forEach((valueRange, sheetIndex) => {
    const sheetName = sheetNames[sheetIndex] ?? `Sheet ${sheetIndex + 1}`;
    const values = valueRange.values ?? [];
    if (values.length === 0) return;

    const headerRow = values[0].map((cell) => String(cell ?? '').trim());
    headerRow.forEach((h) => {
      if (h) headersSet.add(h);
    });

    for (let i = 1; i < values.length; i++) {
      const cells = values[i].map((cell) => String(cell ?? ''));
      if (cells.every((cell) => !cell.trim())) continue;
      allRows.push(rowFromValues(sheetName, i + 1, headerRow, cells));
    }
  });

  return {
    sheetNames,
    headers: [...headersSet],
    rows: allRows,
  };
}

async function syncSpreadsheets(organizationId: string, accessToken: string) {
  const files = await listAllSpreadsheets(accessToken);
  const connection = await googleSheetsRepository.findConnectionOnly(organizationId);
  if (!connection) {
    throw new HttpError(404, 'Google Sheets is not connected');
  }

  const syncedAt = new Date();
  const items = [];

  // Sequential to avoid Google rate limits; each file is full historical pull.
  for (const file of files) {
    try {
      const { sheetNames, headers, rows } = await fetchSpreadsheetRows(accessToken, file.id);
      items.push({
        spreadsheetId: file.id,
        name: file.name,
        url: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}`,
        modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
        sheetNames,
        headers,
        rows: rows as unknown as Prisma.InputJsonValue,
        rowCount: rows.length,
        syncedAt,
      });
    } catch (error) {
      console.error(`Google Sheets sync failed for ${file.id}`, error);
      items.push({
        spreadsheetId: file.id,
        name: file.name,
        url: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}`,
        modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
        sheetNames: [],
        headers: [],
        rows: [] as unknown as Prisma.InputJsonValue,
        rowCount: 0,
        syncedAt,
      });
    }
  }

  await googleSheetsRepository.replaceSpreadsheets(connection.id, items);
  await googleSheetsRepository.setLastSyncedAt(organizationId, syncedAt);
}

function buildStatus(connection: Awaited<ReturnType<typeof googleSheetsRepository.findConnection>>): GoogleSheetsStatusResponse {
  if (!connection) {
    return {
      connection: {
        connected: false,
        configured: isConfigured(),
        spreadsheetCount: 0,
        rowCount: 0,
      },
      spreadsheets: [],
    };
  }

  const spreadsheets = connection.spreadsheets.map(toSpreadsheetItem);
  return {
    connection: {
      connected: true,
      configured: isConfigured(),
      email: connection.email,
      name: connection.name,
      picture: connection.picture,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      spreadsheetCount: spreadsheets.length,
      rowCount: spreadsheets.reduce((sum, sheet) => sum + sheet.rowCount, 0),
    },
    spreadsheets,
  };
}

function findContentForDate(
  spreadsheets: GoogleSpreadsheetItem[],
  date: string
): GoogleSheetsContentMatch {
  const alternatives: GoogleSheetsContentMatch['alternatives'] = [];
  let primary: GoogleSheetsContentMatch | null = null;

  for (const sheet of spreadsheets) {
    for (const row of sheet.rows) {
      if (row.dateValue !== date || !row.content.trim()) continue;
      const entry = {
        spreadsheetId: sheet.spreadsheetId,
        spreadsheetName: sheet.name,
        row,
      };
      if (!primary) {
        primary = {
          date,
          row,
          spreadsheet: {
            id: sheet.id,
            spreadsheetId: sheet.spreadsheetId,
            name: sheet.name,
            url: sheet.url,
          },
          alternatives: [],
        };
      } else {
        alternatives.push(entry);
      }
    }
  }

  if (!primary) {
    return { date, row: null, spreadsheet: null, alternatives: [] };
  }
  return { ...primary, alternatives };
}

export const googleSheetsService = {
  isConfigured,

  async getConnectUrl(organizationId: string): Promise<{ url: string }> {
    if (!isConfigured()) {
      throw new HttpError(
        400,
        'Google Sheets is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'
      );
    }
    const state = await googleSheetsOAuthState.save(organizationId);
    const params = new URLSearchParams({
      client_id: getGoogleEnv('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return { url: `${AUTH_URL}?${params}` };
  },

  async completeConnect(organizationId: string, code: string, state: string) {
    const savedOrg = await googleSheetsOAuthState.consume(state);
    if (!savedOrg || savedOrg !== organizationId) {
      throw new HttpError(400, 'Invalid or expired Google authorization state');
    }

    const token = await exchangeCode(code);
    const user = await googleFetch<{
      email?: string;
      name?: string;
      picture?: string;
    }>(USERINFO_URL, token.access_token);

    if (!user.email) {
      throw new HttpError(400, 'Google did not return an email for this account');
    }

    const existing = await googleSheetsRepository.findConnectionOnly(organizationId);
    await googleSheetsRepository.upsertConnection(organizationId, {
      email: user.email,
      name: user.name ?? null,
      picture: user.picture ?? null,
      accessToken: encrypt(token.access_token),
      refreshToken: token.refresh_token
        ? encrypt(token.refresh_token)
        : existing?.refreshToken ?? null,
      tokenExpiration: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      scopes: token.scope ?? SCOPES.join(' '),
    });

    await syncSpreadsheets(organizationId, token.access_token);
  },

  async getStatus(organizationId: string, options?: { autoSync?: boolean }) {
    let connection = await googleSheetsRepository.findConnection(organizationId);
    if (
      options?.autoSync &&
      connection?.lastSyncedAt &&
      Date.now() - connection.lastSyncedAt.getTime() > AUTO_SYNC_MS
    ) {
      try {
        const accessToken = await getValidAccessToken(organizationId);
        await syncSpreadsheets(organizationId, accessToken);
        connection = await googleSheetsRepository.findConnection(organizationId);
      } catch (error) {
        console.error('Google Sheets auto-sync failed', error);
      }
    }
    return buildStatus(connection);
  },

  async refresh(organizationId: string) {
    const accessToken = await getValidAccessToken(organizationId);
    await syncSpreadsheets(organizationId, accessToken);
    return this.getStatus(organizationId);
  },

  async disconnect(organizationId: string) {
    await googleSheetsRepository.deleteConnection(organizationId);
  },

  async contentForDate(organizationId: string, date: string): Promise<GoogleSheetsContentMatch> {
    const status = await this.getStatus(organizationId, { autoSync: true });
    if (!status.connection.connected) {
      throw new HttpError(404, 'Google Sheets is not connected');
    }
    return findContentForDate(status.spreadsheets, date);
  },

  async getSpreadsheet(organizationId: string, id: string): Promise<GoogleSpreadsheetItem> {
    const row = await googleSheetsRepository.findSpreadsheet(organizationId, id);
    if (!row) {
      throw new HttpError(404, 'Spreadsheet not found');
    }
    return toSpreadsheetItem(row);
  },
};
