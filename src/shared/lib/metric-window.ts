/**
 * Shared metric windows in an organization IANA timezone.
 * last30Days matches Meta last_30d: 30 complete days, excluding today.
 */

export const DEFAULT_ORG_TIMEZONE = 'Asia/Kolkata';

export type MetricWindow = {
  /** Inclusive first complete day (today-30 in tz) as UTC midnight. Use with DATE columns. */
  from: Date;
  /** Inclusive last complete day (today-1 in tz) as UTC midnight. Use with DATE columns. */
  to: Date;
  /** Inclusive DateTime start: 00:00 of today-30 in tz. */
  fromAt: Date;
  /** Exclusive DateTime end: 00:00 of today in tz. */
  until: Date;
};

export function resolveTimeZone(value: string | null | undefined): string {
  const tz = value?.trim();
  if (!tz) return DEFAULT_ORG_TIMEZONE;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_ORG_TIMEZONE;
  }
}

function ymdInZone(now: Date, timeZone: string): { y: number; m: number; d: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    if (!y || !m || !d) throw new Error('incomplete date parts');
    return { y, m, d };
  } catch {
    return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
  }
}

function shiftYmd(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function utcMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** 00:00:00 of calendar y-m-d in `timeZone`, as a UTC Date. */
function zonedMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const utcGuess = Date.UTC(y, m - 1, d);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value])
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    if (!Number.isFinite(asUtc)) return new Date(utcGuess);
    return new Date(utcGuess - (asUtc - utcGuess));
  } catch {
    return new Date(utcGuess);
  }
}

/** Last 30 complete days in `tz`: today-30 … today-1, same shape as Meta last_30d. */
export function last30Days(tz: string, now = new Date()): MetricWindow {
  const zone = resolveTimeZone(tz);
  const today = ymdInZone(now, zone);
  const fromYmd = shiftYmd(today.y, today.m, today.d, -30);
  const toYmd = shiftYmd(today.y, today.m, today.d, -1);
  return {
    from: utcMidnight(fromYmd.y, fromYmd.m, fromYmd.d),
    to: utcMidnight(toYmd.y, toYmd.m, toYmd.d),
    fromAt: zonedMidnight(fromYmd.y, fromYmd.m, fromYmd.d, zone),
    until: zonedMidnight(today.y, today.m, today.d, zone),
  };
}
