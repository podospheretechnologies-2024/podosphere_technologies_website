import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import {
  googleSheetsService,
  spreadsheetIdFromLink,
  spreadsheetUrl,
  type SheetLink,
} from '../google-sheets/google-sheets.service';
import type { GoogleSheetRow } from '../../types/google-sheets';
import type { GrowthClient } from './growth-scope';
import { localDay, shiftDay } from './growth-metrics';

const TIME_ZONE = 'Asia/Kolkata';
const PAST_DAYS = 14;
const AHEAD_DAYS = 60;
const MAX_ROWS = 150;

const PLATFORM_HINTS = ['platform', 'channel', 'network', 'social'];
const FORMAT_HINTS = ['format', 'post type', 'content type', 'type'];
const STATUS_HINTS = ['status', 'stage', 'approval'];

export interface ContentSheetRowDto {
  date: string;
  sheetName: string;
  rowIndex: number;
  content: string;
  platform: string | null;
  format: string | null;
  status: string | null;
  /** A post for this client is already in the Calendar on this day. */
  inCalendar: boolean;
}

export interface ContentSheetDto {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  /** Owner/admin: may connect the agency Google login. */
  canConnect: boolean;
  link: { spreadsheetId: string; url: string; tab: string | null } | null;
  sheet: { name: string; url: string; tabs: string[]; syncedAt: string } | null;
  error: string | null;
  rows: ContentSheetRowDto[];
  /** Rows in the chosen tab(s) with no date the app could read. */
  undated: number;
  from: string;
  to: string;
}

function pickValue(values: Record<string, string>, hints: string[]): string | null {
  const entries = Object.entries(values).map(([k, v]) => [k.trim().toLowerCase(), v.trim()] as const);
  for (const hint of hints) {
    const exact = entries.find(([k, v]) => k === hint && v);
    if (exact) return exact[1];
  }
  for (const hint of hints) {
    const partial = entries.find(([k, v]) => k.includes(hint) && v);
    if (partial) return partial[1];
  }
  return null;
}

/** Pure: sheet rows in the date window, sorted, with the Calendar check. */
export function calendarRows(
  rows: GoogleSheetRow[],
  tab: string | null,
  window: { from: string; to: string },
  postDays: Set<string>
): { rows: ContentSheetRowDto[]; undated: number } {
  const inTab = rows.filter((row) => !tab || row.sheetName === tab);
  const undated = inTab.filter((row) => !row.dateValue).length;
  const out = inTab
    .filter((row): row is GoogleSheetRow & { dateValue: string } => Boolean(row.dateValue))
    .filter((row) => row.dateValue >= window.from && row.dateValue <= window.to)
    .sort((a, b) => a.dateValue.localeCompare(b.dateValue) || a.rowIndex - b.rowIndex)
    .slice(0, MAX_ROWS)
    .map((row) => ({
      date: row.dateValue,
      sheetName: row.sheetName,
      rowIndex: row.rowIndex,
      content: row.content.slice(0, 2000),
      platform: pickValue(row.values, PLATFORM_HINTS),
      format: pickValue(row.values, FORMAT_HINTS),
      status: pickValue(row.values, STATUS_HINTS),
      inCalendar: postDays.has(row.dateValue),
    }));
  return { rows: out, undated };
}

function linkFromRow(row: { contentSheetUrl: string | null; contentSheetTab: string | null } | null): SheetLink | null {
  const spreadsheetId = spreadsheetIdFromLink(row?.contentSheetUrl);
  return spreadsheetId ? { spreadsheetId, tab: row?.contentSheetTab || null } : null;
}

/** Every client's linked calendar sheet in the organization. */
async function linksByClient(organizationId: string): Promise<Map<string, SheetLink>> {
  const rows = await prisma.socialGrowthSettings.findMany({
    where: { organizationId, contentSheetUrl: { not: null } },
    select: { customerId: true, contentSheetUrl: true, contentSheetTab: true },
  });
  const out = new Map<string, SheetLink>();
  for (const row of rows) {
    const link = linkFromRow(row);
    if (link) out.set(row.customerId, link);
  }
  return out;
}

/**
 * Which sheets a request may use. `exclude`: sheets (or tabs) linked to clients outside the scope, always
 * hidden. `only`: when exactly one client is picked and it has a calendar sheet, just that sheet.
 * "All clients" (owner/admin, nothing picked) is not narrowed.
 */
export async function sheetScopeFor(scope: ClientScope): Promise<{ only?: SheetLink[]; exclude: SheetLink[] }> {
  if (scope.customerIds === 'all') return { exclude: [] };
  const links = await linksByClient(scope.organizationId);
  const inScope = new Set(scope.customerIds);
  const ownLinks = scope.customerIds.flatMap((id) => {
    const link = links.get(id);
    return link ? [link] : [];
  });
  // Other clients' links, except one that is exactly an in-scope client's own link (same sheet, same tab).
  const exclude = [...links.entries()]
    .filter(([customerId]) => !inScope.has(customerId))
    .map(([, link]) => link)
    .filter((link) => !ownLinks.some((own) => own.spreadsheetId === link.spreadsheetId && own.tab === link.tab));
  const own = scope.customerIds.length === 1 ? links.get(scope.customerIds[0]) : undefined;
  return own ? { only: [own], exclude } : { exclude };
}

async function postDaysFor(organizationId: string, customerId: string, from: string, to: string): Promise<Set<string>> {
  const posts = await prisma.socialPost.findMany({
    where: {
      organizationId,
      customerId,
      deletedAt: null,
      parentPostId: null,
      publishDate: { gte: new Date(`${shiftDay(from, -1)}T00:00:00.000Z`), lte: new Date(`${shiftDay(to, 1)}T23:59:59.999Z`) },
    },
    select: { publishDate: true },
    take: 1000,
  });
  return new Set(posts.map((p) => localDay(p.publishDate, TIME_ZONE)));
}

export const contentSheetService = {
  async status(gc: GrowthClient, options: { canConnect: boolean; refresh?: boolean }): Promise<ContentSheetDto> {
    const today = localDay(new Date(), TIME_ZONE);
    const from = shiftDay(today, -PAST_DAYS);
    const to = shiftDay(today, AHEAD_DAYS);
    const [settings, connection] = await Promise.all([
      prisma.socialGrowthSettings.findFirst({
        where: { organizationId: gc.organizationId, customerId: gc.customerId },
        select: { contentSheetUrl: true, contentSheetTab: true },
      }),
      prisma.socialGoogleSheetsConnection.findUnique({
        where: { organizationId: gc.organizationId },
        select: { email: true },
      }),
    ]);
    const link = linkFromRow(settings);
    const base: ContentSheetDto = {
      configured: googleSheetsService.isConfigured(),
      connected: Boolean(connection),
      googleEmail: connection?.email ?? null,
      canConnect: options.canConnect,
      link: link ? { ...link, url: settings?.contentSheetUrl ?? spreadsheetUrl(link.spreadsheetId) } : null,
      sheet: null,
      error: null,
      rows: [],
      undated: 0,
      from,
      to,
    };
    if (!link || !connection) {
      if (settings?.contentSheetUrl && !link) base.error = 'The saved link is not a Google Sheets link.';
      return base;
    }
    try {
      const sheet = await googleSheetsService.clientSpreadsheet(gc.organizationId, link.spreadsheetId, { force: options.refresh });
      const postDays = await postDaysFor(gc.organizationId, gc.customerId, from, to);
      const { rows, undated } = calendarRows(sheet.rows, link.tab, { from, to }, postDays);
      const tabMissing = link.tab && !sheet.sheetNames.includes(link.tab);
      return {
        ...base,
        sheet: { name: sheet.name, url: sheet.url, tabs: sheet.sheetNames, syncedAt: sheet.syncedAt },
        error: tabMissing ? `The tab "${link.tab}" is no longer in this sheet. Pick the tab again in Setup.` : null,
        rows,
        undated,
      };
    } catch (error) {
      return { ...base, error: error instanceof HttpError ? error.message : 'Could not read the sheet from Google.' };
    }
  },

  /** Spreadsheets the agency Google login can see, for the Setup picker. */
  async options(organizationId: string) {
    return googleSheetsService.listLite(organizationId);
  },

  /** Links (or clears with null) this client's content calendar sheet. Checks access when Google is connected. */
  async setLink(gc: GrowthClient, input: { link: string | null; tab: string | null }) {
    if (!input.link) {
      await prisma.socialGrowthSettings.upsert({
        where: { customerId: gc.customerId },
        update: { contentSheetUrl: null, contentSheetTab: null },
        create: { organizationId: gc.organizationId, customerId: gc.customerId, contentSheetUrl: null, contentSheetTab: null },
      });
      return;
    }
    const spreadsheetId = spreadsheetIdFromLink(input.link);
    if (!spreadsheetId) throw new HttpError(400, 'Paste a Google Sheets link (https://docs.google.com/spreadsheets/d/…).');
    const tab = input.tab?.trim() || null;
    const connection = await prisma.socialGoogleSheetsConnection.findUnique({
      where: { organizationId: gc.organizationId },
      select: { id: true },
    });
    if (connection) {
      const sheet = await googleSheetsService.clientSpreadsheet(gc.organizationId, spreadsheetId, { force: true });
      if (tab && !sheet.sheetNames.includes(tab)) throw new HttpError(400, `This sheet has no tab named "${tab}".`);
    }
    const data = { contentSheetUrl: spreadsheetUrl(spreadsheetId), contentSheetTab: tab };
    await prisma.socialGrowthSettings.upsert({
      where: { customerId: gc.customerId },
      update: data,
      create: { organizationId: gc.organizationId, customerId: gc.customerId, ...data },
    });
  },
};
