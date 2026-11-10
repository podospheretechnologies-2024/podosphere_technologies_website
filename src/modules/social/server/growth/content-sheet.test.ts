import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleSheetRow, GoogleSpreadsheetItem } from '../../types/google-sheets';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/env', () => ({ getServerEnv: () => ({ APP_URL: 'https://app.test', ENCRYPTION_KEY: 'x'.repeat(32) }) }));
vi.mock('@/shared/lib/redis', () => ({ redis: { set: vi.fn(), getdel: vi.fn() } }));
vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    socialGrowthSettings: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), upsert: vi.fn() },
    socialGoogleSheetsConnection: { findUnique: vi.fn() },
    socialGoogleSpreadsheet: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    socialPost: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { filterSheetRows, spreadsheetIdFromLink } = await import('../google-sheets/google-sheets.service');
const { calendarRows, sheetScopeFor } = await import('./content-sheet.service');
const { prisma } = await import('@/shared/lib/prisma');

const ID_A = 'A'.repeat(30);
const ID_B = 'B'.repeat(30);

function row(sheetName: string, rowIndex: number, dateValue: string | null, values: Record<string, string> = {}): GoogleSheetRow {
  return { sheetName, rowIndex, dateValue, content: `post ${rowIndex}`, values };
}

function sheet(spreadsheetId: string, rows: GoogleSheetRow[]): GoogleSpreadsheetItem {
  return {
    id: `row-${spreadsheetId}`,
    spreadsheetId,
    name: spreadsheetId.slice(0, 1),
    url: '',
    modifiedTime: null,
    sheetNames: [...new Set(rows.map((r) => r.sheetName))],
    headers: [],
    rowCount: rows.length,
    syncedAt: '2026-11-10T00:00:00.000Z',
    rows,
  };
}

describe('spreadsheetIdFromLink', () => {
  it('reads the id from sheet links and bare ids', () => {
    expect(spreadsheetIdFromLink(`https://docs.google.com/spreadsheets/d/${ID_A}/edit#gid=0`)).toBe(ID_A);
    expect(spreadsheetIdFromLink(`https://docs.google.com/spreadsheets/u/1/d/${ID_A}/edit`)).toBe(ID_A);
    expect(spreadsheetIdFromLink(ID_B)).toBe(ID_B);
  });

  it('refuses links that are not Google Sheets', () => {
    expect(spreadsheetIdFromLink('https://notion.so/calendar')).toBeNull();
    expect(spreadsheetIdFromLink('')).toBeNull();
    expect(spreadsheetIdFromLink(null)).toBeNull();
  });
});

describe('filterSheetRows', () => {
  const master = sheet(ID_A, [row('Client A', 2, '2026-11-12'), row('Client B', 2, '2026-11-12')]);
  const other = sheet(ID_B, [row('Sheet1', 2, '2026-11-12')]);

  it('keeps only the linked tab of the linked sheet', () => {
    const out = filterSheetRows([master, other], { only: [{ spreadsheetId: ID_A, tab: 'Client A' }] });
    expect(out).toHaveLength(1);
    expect(out[0].rows.map((r) => r.sheetName)).toEqual(['Client A']);
    expect(out[0].sheetNames).toEqual(['Client A']);
  });

  it('drops a whole sheet linked to another client, or just its tab', () => {
    const out = filterSheetRows([master, other], {
      exclude: [
        { spreadsheetId: ID_B, tab: null },
        { spreadsheetId: ID_A, tab: 'Client B' },
      ],
    });
    expect(out.map((s) => s.spreadsheetId)).toEqual([ID_A]);
    expect(out[0].rows.map((r) => r.sheetName)).toEqual(['Client A']);
    expect(out[0].sheetNames).toEqual(['Client A']);
  });
});

describe('calendarRows', () => {
  it('keeps dated rows in the window, sorted, with platform/format/status and the Calendar check', () => {
    const rows = [
      row('Nov', 4, '2026-11-20', { Platform: 'Instagram', 'Post type': 'Reel', Status: 'Approved' }),
      row('Nov', 3, '2026-11-12'),
      row('Nov', 5, '2027-03-01'),
      row('Nov', 6, null),
      row('Old', 2, '2026-11-12'),
    ];
    const out = calendarRows(rows, 'Nov', { from: '2026-10-27', to: '2027-01-09' }, new Set(['2026-11-12']));
    expect(out.undated).toBe(1);
    expect(out.rows.map((r) => [r.date, r.inCalendar])).toEqual([
      ['2026-11-12', true],
      ['2026-11-20', false],
    ]);
    expect(out.rows[1]).toMatchObject({ platform: 'Instagram', format: 'Reel', status: 'Approved' });
  });
});

describe('sheetScopeFor', () => {
  const findMany = prisma.socialGrowthSettings.findMany as unknown as ReturnType<typeof vi.fn>;
  beforeEach(() => {
    findMany.mockResolvedValue([
      { customerId: 'client-A', contentSheetUrl: `https://docs.google.com/spreadsheets/d/${ID_A}/edit`, contentSheetTab: 'Client A' },
      { customerId: 'client-B', contentSheetUrl: `https://docs.google.com/spreadsheets/d/${ID_A}/edit`, contentSheetTab: 'Client B' },
      { customerId: 'client-C', contentSheetUrl: `https://docs.google.com/spreadsheets/d/${ID_B}/edit`, contentSheetTab: null },
    ]);
  });

  it('a picked client uses only its own sheet and hides every other client', async () => {
    const out = await sheetScopeFor({ organizationId: 'org', customerIds: ['client-A'] });
    expect(out.only).toEqual([{ spreadsheetId: ID_A, tab: 'Client A' }]);
    expect(out.exclude).toEqual([
      { spreadsheetId: ID_A, tab: 'Client B' },
      { spreadsheetId: ID_B, tab: null },
    ]);
  });

  it('a client with no sheet still never gets other clients’ sheets', async () => {
    const out = await sheetScopeFor({ organizationId: 'org', customerIds: ['client-D'] });
    expect(out.only).toBeUndefined();
    expect(out.exclude).toHaveLength(3);
  });

  it('"All clients" is not narrowed', async () => {
    expect(await sheetScopeFor({ organizationId: 'org', customerIds: 'all' })).toEqual({ exclude: [] });
  });
});
