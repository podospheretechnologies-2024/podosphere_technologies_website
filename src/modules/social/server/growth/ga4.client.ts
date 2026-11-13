/**
 * Google Analytics 4 HTTP client (Admin API for discovery, Data API for reports) plus pure parsers.
 * Read-only: only GET listings and runReport / batchRunReports are called.
 */

const ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const DATA_BASE = 'https://analyticsdata.googleapis.com/v1beta';

export const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

export class Ga4ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'Ga4ApiError';
  }
  get isAuthError() {
    return this.status === 401;
  }
}

interface GoogleErrorBody {
  error?: { message?: string; status?: string };
}

const GA4_TIMEOUT_MS = 120_000;

async function ga4Fetch<T>(url: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(GA4_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Ga4ApiError(
        'Google Analytics took too long to respond. Try Sync now again in a minute.',
        504
      );
    }
    throw error;
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as GoogleErrorBody | null;
    const detail = body?.error?.message ?? response.statusText;
    if (response.status === 401) throw new Ga4ApiError('Google session expired. Connect Google Analytics again.', 401);
    if (response.status === 429) throw new Ga4ApiError('Google Analytics quota reached. Try again later.', 429);
    throw new Ga4ApiError(`Google Analytics: ${detail}`.slice(0, 1000), response.status);
  }
  return (await response.json()) as T;
}

// ---------- discovery (Admin API) ----------

export interface DiscoveredProperty {
  propertyId: string;
  displayName: string;
  accountName: string | null;
}

interface AccountSummariesPage {
  accountSummaries?: {
    displayName?: string;
    propertySummaries?: { property?: string; displayName?: string; propertyType?: string }[];
  }[];
  nextPageToken?: string;
}

/** Every GA4 property the signed-in Google login can read (Viewer or higher). */
export async function listProperties(accessToken: string): Promise<DiscoveredProperty[]> {
  const out = new Map<string, DiscoveredProperty>();
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ pageSize: '200' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await ga4Fetch<AccountSummariesPage>(`${ADMIN_BASE}/accountSummaries?${params}`, accessToken);
    for (const property of parseAccountSummaries(data)) out.set(property.propertyId, property);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return [...out.values()];
}

export function parseAccountSummaries(data: AccountSummariesPage): DiscoveredProperty[] {
  const out: DiscoveredProperty[] = [];
  for (const account of data.accountSummaries ?? []) {
    for (const summary of account.propertySummaries ?? []) {
      const propertyId = summary.property?.replace('properties/', '') ?? '';
      // Sub-properties and roll-ups are skipped: a client store is an ordinary property.
      if (!/^\d+$/.test(propertyId)) continue;
      if (summary.propertyType && summary.propertyType !== 'PROPERTY_TYPE_ORDINARY') continue;
      out.push({ propertyId, displayName: summary.displayName || propertyId, accountName: account.displayName ?? null });
    }
  }
  return out;
}

export async function getPropertyDetails(accessToken: string, propertyId: string) {
  const data = await ga4Fetch<{ displayName?: string; currencyCode?: string; timeZone?: string }>(
    `${ADMIN_BASE}/properties/${propertyId}`,
    accessToken
  );
  return { displayName: data.displayName ?? null, currency: data.currencyCode ?? null, timeZone: data.timeZone ?? null };
}

// ---------- reports (Data API) ----------

export interface ReportRequest {
  dateRanges: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  orderBys?: { metric?: { metricName: string }; dimension?: { dimensionName: string }; desc?: boolean }[];
  limit?: number;
}

export interface ReportResponse {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
}

export async function runReport(accessToken: string, propertyId: string, request: ReportRequest): Promise<ReportResponse> {
  return ga4Fetch<ReportResponse>(`${DATA_BASE}/properties/${propertyId}:runReport`, accessToken, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** Up to 5 reports in one call. */
export async function batchRunReports(accessToken: string, propertyId: string, requests: ReportRequest[]): Promise<ReportResponse[]> {
  const data = await ga4Fetch<{ reports?: ReportResponse[] }>(`${DATA_BASE}/properties/${propertyId}:batchRunReports`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });
  return data.reports ?? [];
}

/** Daily metrics stored per property per day. Max 10 metrics per GA4 request. */
export const DAILY_METRICS = [
  'sessions',
  'totalUsers',
  'newUsers',
  'engagedSessions',
  'addToCarts',
  'checkouts',
  'ecommercePurchases',
  'purchaseRevenue',
  'keyEvents',
] as const;

export interface Ga4DayRow {
  date: string;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  engagedSessions: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  keyEvents: number;
}

export type Ga4Totals = Omit<Ga4DayRow, 'date'>;

const numberOf = (value: string | undefined) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Report rows → { [metricName]: number } keyed by the joined dimension values. */
function rowsAsRecords(report: ReportResponse): { dims: string[]; metrics: Record<string, number> }[] {
  const metricNames = (report.metricHeaders ?? []).map((h) => h.name);
  return (report.rows ?? []).map((row) => {
    const metrics: Record<string, number> = {};
    metricNames.forEach((name, i) => {
      metrics[name] = numberOf(row.metricValues?.[i]?.value);
    });
    return { dims: (row.dimensionValues ?? []).map((d) => d.value ?? ''), metrics };
  });
}

function toTotals(m: Record<string, number>): Ga4Totals {
  return {
    sessions: Math.round(m.sessions ?? 0),
    totalUsers: Math.round(m.totalUsers ?? 0),
    newUsers: Math.round(m.newUsers ?? 0),
    engagedSessions: Math.round(m.engagedSessions ?? 0),
    addToCarts: Math.round(m.addToCarts ?? 0),
    checkouts: Math.round(m.checkouts ?? 0),
    purchases: Math.round(m.ecommercePurchases ?? 0),
    revenue: Math.round((m.purchaseRevenue ?? 0) * 100) / 100,
    keyEvents: Math.round((m.keyEvents ?? 0) * 100) / 100,
  };
}

/** GA4 "date" dimension is "YYYYMMDD" in the property's time zone. */
export function parseDailyReport(report: ReportResponse): Ga4DayRow[] {
  return rowsAsRecords(report)
    .map(({ dims, metrics }) => {
      const raw = dims[0] ?? '';
      if (!/^\d{8}$/.test(raw)) return null;
      return { date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`, ...toTotals(metrics) };
    })
    .filter((row): row is Ga4DayRow => row !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function parseTotalsReport(report: ReportResponse): Ga4Totals {
  return toTotals(rowsAsRecords(report)[0]?.metrics ?? {});
}

export interface Ga4BreakdownRow {
  name: string;
  sessions: number;
  users: number;
  atc: number;
  purchases: number;
  revenue: number;
}

export const BREAKDOWN_METRICS = ['sessions', 'totalUsers', 'addToCarts', 'ecommercePurchases', 'purchaseRevenue'] as const;

export function parseBreakdownReport(report: ReportResponse): Ga4BreakdownRow[] {
  return rowsAsRecords(report).map(({ dims, metrics }) => ({
    name: dims[0] || '(not set)',
    sessions: Math.round(metrics.sessions ?? 0),
    users: Math.round(metrics.totalUsers ?? 0),
    atc: Math.round(metrics.addToCarts ?? 0),
    purchases: Math.round(metrics.ecommercePurchases ?? 0),
    revenue: Math.round((metrics.purchaseRevenue ?? 0) * 100) / 100,
  }));
}

export function breakdownRequest(dimension: string, days: number, limit = 10): ReportRequest {
  return {
    dateRanges: [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: dimension }],
    metrics: BREAKDOWN_METRICS.map((name) => ({ name })),
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit,
  };
}
