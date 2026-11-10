/**
 * Pure helpers for the Growth Desk: store-local days, order bucketing, ROAS and ShopifyQL parsing.
 * No I/O here so it is easy to unit test.
 */

/** "YYYY-MM-DD" of an instant in an IANA time zone (falls back to UTC on a bad zone). */
export function localDay(instant: string | Date, timeZone: string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const out = `${get('year')}-${get('month')}-${get('day')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch {
    // fall through
  }
  return date.toISOString().slice(0, 10);
}

export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = from; day <= to && out.length < 1000; day = shiftDay(day, 1)) out.push(day);
  return out;
}

export interface DayBucket {
  orders: number;
  sales: number;
  cancelledOrders: number;
  cancelledSales: number;
}

export function bucketOrders(
  orders: readonly { createdAt: string; cancelledAt: string | null; test: boolean; total: number }[],
  timeZone: string
): Map<string, DayBucket> {
  const map = new Map<string, DayBucket>();
  for (const order of orders) {
    if (order.test) continue;
    const day = localDay(order.createdAt, timeZone);
    const bucket = map.get(day) ?? { orders: 0, sales: 0, cancelledOrders: 0, cancelledSales: 0 };
    if (order.cancelledAt) {
      bucket.cancelledOrders += 1;
      bucket.cancelledSales += order.total;
    } else {
      bucket.orders += 1;
      bucket.sales += order.total;
    }
    map.set(day, bucket);
  }
  for (const bucket of map.values()) {
    bucket.sales = Math.round(bucket.sales * 100) / 100;
    bucket.cancelledSales = Math.round(bucket.cancelledSales * 100) / 100;
  }
  return map;
}

export function roas(revenue: number | null | undefined, spend: number | null | undefined): number | null {
  if (revenue == null || !spend || spend <= 0) return null;
  return Math.round((revenue / spend) * 100) / 100;
}

export function ratio(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (part == null || !whole) return null;
  return part / whole;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Picks the first column whose name matches one of the patterns. */
export function pickColumn(columns: readonly string[], patterns: readonly RegExp[]): string | null {
  for (const pattern of patterns) {
    const hit = columns.find((c) => pattern.test(c));
    if (hit) return hit;
  }
  return null;
}

const DAY_COLUMNS = [/^day$/i, /^date$/i, /day/i, /date/i];
const SESSION_COLUMNS = [/^sessions$/i, /^total_sessions$/i, /sessions$/i];
const CART_COLUMNS = [/cart/i];
const CHECKOUT_COLUMNS = [/completed_checkout/i, /checkout/i];

export interface TrafficDay {
  sessions: number | null;
  addToCart: number | null;
  checkouts: number | null;
}

/** ShopifyQL "GROUP BY day" table → day → sessions / add-to-cart / checkouts. */
export function parseTrafficByDay(table: {
  columns: readonly string[];
  rows: readonly Record<string, unknown>[];
}): Map<string, TrafficDay> {
  const out = new Map<string, TrafficDay>();
  const dayCol = pickColumn(table.columns, DAY_COLUMNS);
  const sessionCol = pickColumn(table.columns, SESSION_COLUMNS);
  if (!dayCol || !sessionCol) return out;
  const cartCol = pickColumn(
    table.columns.filter((c) => c !== sessionCol),
    CART_COLUMNS
  );
  const checkoutCol = pickColumn(
    table.columns.filter((c) => c !== sessionCol && c !== cartCol),
    CHECKOUT_COLUMNS
  );
  for (const row of table.rows) {
    const rawDay = row[dayCol];
    if (typeof rawDay !== 'string') continue;
    const day = rawDay.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    out.set(day, {
      sessions: toNumber(row[sessionCol]),
      addToCart: cartCol ? toNumber(row[cartCol]) : null,
      checkouts: checkoutCol ? toNumber(row[checkoutCol]) : null,
    });
  }
  return out;
}

export type RateRow = {
  name: string;
  sessions: number;
  atc: number;
};

/** ShopifyQL "GROUP BY <dimension>" table → [{ name, sessions, atc }], biggest first, top N. */
export function parseBreakdown(
  table: { columns: readonly string[]; rows: readonly Record<string, unknown>[] },
  dimensionPatterns: readonly RegExp[],
  limit = 10
): RateRow[] {
  const nameCol = pickColumn(table.columns, dimensionPatterns);
  const sessionCol = pickColumn(table.columns, SESSION_COLUMNS);
  if (!nameCol || !sessionCol) return [];
  const cartCol = pickColumn(
    table.columns.filter((c) => c !== sessionCol),
    CART_COLUMNS
  );
  return table.rows
    .map((row) => ({
      name: String(row[nameCol] ?? '(none)') || '(none)',
      sessions: toNumber(row[sessionCol]) ?? 0,
      atc: cartCol ? (toNumber(row[cartCol]) ?? 0) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

/** Next 15-day (or N-day) report due date from the last report's creation day. */
export function reportDue(
  lastCreatedDay: string | null,
  today: string,
  everyDays: number
): { due: boolean; nextDue: string | null } {
  if (!lastCreatedDay) return { due: true, nextDue: null };
  const nextDue = shiftDay(lastCreatedDay, everyDays);
  return { due: today >= nextDue, nextDue };
}
