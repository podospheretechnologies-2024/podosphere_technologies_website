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
import { googleSheetsOAuthState, type GoogleSheetsReturnTo } from './google-sheets-oauth-state';
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

const NOT_CONFIGURED =
  'Google Sheets is not configured. Set GOOGLE_SHEETS_CLIENT_ID and GOOGLE_SHEETS_CLIENT_SECRET (or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) in .env.';

// Prefers the Sheets-only OAuth client (company Cloud project, Internal consent screen: drive.readonly
// is a restricted scope, so an External app would need a security review or expire every 7 days);
// falls back to the client shared with YouTube / GBP.
function oauthClient(): { clientId?: string; clientSecret?: string } {
  const env = process.env;
  // Fall back as a pair, never field by field: an id from one Cloud project with a secret from
  // another passes isConfigured() and then dies at token exchange with an opaque invalid_client.
  if (env.GOOGLE_SHEETS_CLIENT_ID || env.GOOGLE_SHEETS_CLIENT_SECRET) {
    return { clientId: env.GOOGLE_SHEETS_CLIENT_ID, clientSecret: env.GOOGLE_SHEETS_CLIENT_SECRET };
  }
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

function isConfigured(): boolean {
  const { clientId, clientSecret } = oauthClient();
  return Boolean(clientId && clientSecret);
}

function getGoogleEnv(name: 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'): string {
  const { clientId, clientSecret } = oauthClient();
  const value = name === 'GOOGLE_CLIENT_ID' ? clientId : clientSecret;
  if (!value) {
    throw new HttpError(400, NOT_CONFIGURED);
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
  rows?: Prisma.JsonValue;
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
    // Status/list queries omit `rows` so MySQL never sorts megabyte JSON blobs.
    rows: row.rows === undefined ? [] : parseRowsJson(row.rows),
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
): Promise<{ title: string | null; sheetNames: string[]; headers: string[]; rows: GoogleSheetRow[] }> {
  const meta = await googleFetch<{
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`, accessToken);

  const title = meta.properties?.title?.trim() || null;
  const sheetNames = (meta.sheets ?? [])
    .map((sheet) => sheet.properties?.title?.trim())
    .filter((title): title is string => Boolean(title));

  if (sheetNames.length === 0) {
    return { title, sheetNames: [], headers: [], rows: [] };
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
    title,
    sheetNames,
    headers: [...headersSet],
    rows: allRows,
  };
}

/** Pulls a value out of a Google Sheets link (or takes a bare spreadsheet id). Null when it is not one. */
export function spreadsheetIdFromLink(link: string | null | undefined): string | null {
  const value = (link ?? '').trim();
  if (!value) return null;
  const fromUrl = value.match(/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{20,})/);
  if (fromUrl) return fromUrl[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(value) ? value : null;
}

export function spreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

/** One spreadsheet, optionally one tab, that belongs to one client. */
export interface SheetLink {
  spreadsheetId: string;
  tab: string | null;
}

function tabInLink(spreadsheetId: string, tab: string, link: SheetLink): boolean {
  return link.spreadsheetId === spreadsheetId && (!link.tab || link.tab === tab);
}

/**
 * Keeps only what `only` names (when given) and drops what `exclude` names: whole spreadsheets
 * when the link has no tab, else just that tab (its rows and its tab name).
 */
export function filterSheetRows(
  spreadsheets: GoogleSpreadsheetItem[],
  options: { only?: SheetLink[]; exclude?: SheetLink[] }
): GoogleSpreadsheetItem[] {
  const keepTab = (spreadsheetId: string, tab: string) =>
    (!options.only || options.only.some((link) => tabInLink(spreadsheetId, tab, link))) &&
    !options.exclude?.some((link) => tabInLink(spreadsheetId, tab, link));
  return spreadsheets
    .filter((sheet) => !options.only || options.only.some((link) => link.spreadsheetId === sheet.spreadsheetId))
    .filter((sheet) => !options.exclude?.some((link) => link.spreadsheetId === sheet.spreadsheetId && !link.tab))
    .map((sheet) => {
      const rows = sheet.rows.filter((row) => keepTab(sheet.spreadsheetId, row.sheetName));
      const sheetNames = sheet.sheetNames.filter((tab) => keepTab(sheet.spreadsheetId, tab));
      return { ...sheet, sheetNames, rows, rowCount: rows.length };
    });
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
      rowCount: spreadsheets.reduce((sum: number, sheet: GoogleSpreadsheetItem) => sum + sheet.rowCount, 0),
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

  async getConnectUrl(
    organizationId: string,
    returnTo: GoogleSheetsReturnTo = 'automation'
  ): Promise<{ url: string }> {
    if (!isConfigured()) {
      throw new HttpError(400, NOT_CONFIGURED);
    }
    const state = await googleSheetsOAuthState.save(organizationId, returnTo);
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

  /** Finishes the Google login and says where the user started it from. */
  async completeConnect(
    organizationId: string,
    code: string,
    state: string
  ): Promise<{ returnTo: GoogleSheetsReturnTo }> {
    const saved = await googleSheetsOAuthState.consume(state);
    if (!saved || saved.organizationId !== organizationId) {
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
    return { returnTo: saved.returnTo };
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

  /**
   * Sheet content for a post date.
   * `only`: the picked client's own calendar sheet(s), read fresh; nothing else is searched.
   * `exclude`: calendar sheets of other clients, never offered for this post.
   */
  async contentForDate(
    organizationId: string,
    date: string,
    options: { only?: SheetLink[]; exclude?: SheetLink[] } = {}
  ): Promise<GoogleSheetsContentMatch> {
    if (options.only?.length) {
      const sheets: GoogleSpreadsheetItem[] = [];
      for (const link of options.only) {
        sheets.push(await this.clientSpreadsheet(organizationId, link.spreadsheetId));
      }
      return findContentForDate(filterSheetRows(sheets, options), date);
    }
    const status = await this.getStatus(organizationId, { autoSync: true });
    if (!status.connection.connected) {
      throw new HttpError(404, 'Google Sheets is not connected');
    }
    // Status omits row bodies; load each sheet (cache / live) before matching the date.
    const withRows: GoogleSpreadsheetItem[] = [];
    for (const sheet of filterSheetRows(status.spreadsheets, { exclude: options.exclude })) {
      withRows.push(await this.clientSpreadsheet(organizationId, sheet.spreadsheetId));
    }
    return findContentForDate(withRows, date);
  },

  /** Lightweight list for pickers: spreadsheet names and tab names, no rows. */
  async listLite(organizationId: string) {
    const rows = await googleSheetsRepository.listSpreadsheetsLite(organizationId);
    return rows.map((row) => ({
      spreadsheetId: row.spreadsheetId,
      name: row.name,
      url: row.url,
      sheetNames: parseStringArray(row.sheetNames),
      rowCount: row.rowCount,
    }));
  },

  /**
   * One spreadsheet by its Google id, from the cache when fresh, else read live from Google and cached.
   * Works for a pasted link even when the full Drive sync has not picked the file up yet.
   */
  async clientSpreadsheet(
    organizationId: string,
    spreadsheetId: string,
    options: { force?: boolean } = {}
  ): Promise<GoogleSpreadsheetItem> {
    const connection = await googleSheetsRepository.findConnectionOnly(organizationId);
    if (!connection) {
      throw new HttpError(404, 'Google Sheets is not connected');
    }
    const cached = await googleSheetsRepository.findBySpreadsheetId(connection.id, spreadsheetId);
    if (cached && !options.force && Date.now() - cached.syncedAt.getTime() < AUTO_SYNC_MS) {
      return toSpreadsheetItem(cached);
    }
    const accessToken = await getValidAccessToken(organizationId);
    let data: Awaited<ReturnType<typeof fetchSpreadsheetRows>>;
    try {
      data = await fetchSpreadsheetRows(accessToken, spreadsheetId);
    } catch (error) {
      if (cached) return toSpreadsheetItem(cached);
      if (error instanceof HttpError && error.message.includes('(404)')) {
        throw new HttpError(404, `The connected Google account (${connection.email}) cannot find this sheet. Share it with that account.`);
      }
      if (error instanceof HttpError && error.message.includes('(403)')) {
        throw new HttpError(403, `The connected Google account (${connection.email}) has no access to this sheet. Share it with that account (Viewer is enough).`);
      }
      throw error;
    }
    const saved = await googleSheetsRepository.upsertSpreadsheet(connection.id, {
      spreadsheetId,
      name: data.title ?? cached?.name ?? 'Content calendar',
      url: cached?.url ?? spreadsheetUrl(spreadsheetId),
      modifiedTime: cached?.modifiedTime ?? null,
      sheetNames: data.sheetNames,
      headers: data.headers,
      rows: data.rows as unknown as Prisma.InputJsonValue,
      rowCount: data.rows.length,
      syncedAt: new Date(),
    });
    return toSpreadsheetItem(saved);
  },

  async getSpreadsheet(organizationId: string, id: string): Promise<GoogleSpreadsheetItem> {
    const row = await googleSheetsRepository.findSpreadsheet(organizationId, id);
    if (!row) {
      throw new HttpError(404, 'Spreadsheet not found');
    }
    return toSpreadsheetItem(row);
  },
};
