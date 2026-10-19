import { WHATSAPP_AUTO_REPLY_DEFAULT_TIMEZONE } from '../../config/whatsapp-auto-reply';

export interface AutoReplyMatchFields {
  matchType: string;
  pattern: string;
  caseSensitive: boolean;
}

export interface AutoReplyBusinessHoursFields {
  businessHoursEnabled: boolean;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  businessHoursTimezone: string | null;
  businessHoursDays: unknown;
}

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm || !HH_MM.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function parseDays(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const days = raw.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6);
  return days.length > 0 ? days : null;
}

/** Local weekday (0–6) and minutes-since-midnight in `timeZone`. */
export function localDayAndMinutes(
  now: Date,
  timeZone: string
): { day: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const day = dayMap[weekday];
    if (day === undefined) return null;
    return { day, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

/**
 * When business hours are disabled → always true.
 * When enabled, require start/end; days empty/null → every day.
 * Overnight windows (e.g. 22:00–06:00) are supported.
 */
export function isWithinBusinessHours(
  rule: AutoReplyBusinessHoursFields,
  now: Date = new Date()
): boolean {
  if (!rule.businessHoursEnabled) return true;

  const start = parseMinutes(rule.businessHoursStart);
  const end = parseMinutes(rule.businessHoursEnd);
  if (start === null || end === null) return false;

  const tz = rule.businessHoursTimezone?.trim() || WHATSAPP_AUTO_REPLY_DEFAULT_TIMEZONE;
  const local = localDayAndMinutes(now, tz);
  if (!local) return false;

  const days = parseDays(rule.businessHoursDays);
  if (days && !days.includes(local.day)) return false;

  if (start === end) return true; // treat as always open that day
  if (start < end) {
    return local.minutes >= start && local.minutes < end;
  }
  // Overnight: e.g. 22:00–06:00
  return local.minutes >= start || local.minutes < end;
}

/** Keyword = substring; regex = JS RegExp. Invalid regex never matches. */
export function matchesAutoReplyPattern(body: string, rule: AutoReplyMatchFields): boolean {
  const text = body ?? '';
  if (!rule.pattern) return false;

  if (rule.matchType === 'keyword') {
    if (rule.caseSensitive) {
      return text.includes(rule.pattern);
    }
    return text.toLowerCase().includes(rule.pattern.toLowerCase());
  }

  if (rule.matchType === 'regex') {
    try {
      const flags = rule.caseSensitive ? '' : 'i';
      return new RegExp(rule.pattern, flags).test(text);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * First active rule that is in business hours and matches the body.
 * Caller should pass rules already sorted by priority ascending, then createdAt.
 */
export function findMatchingAutoReply<
  T extends AutoReplyMatchFields & AutoReplyBusinessHoursFields,
>(rules: T[], body: string, now: Date = new Date()): T | null {
  for (const rule of rules) {
    if (!isWithinBusinessHours(rule, now)) continue;
    if (matchesAutoReplyPattern(body, rule)) return rule;
  }
  return null;
}
