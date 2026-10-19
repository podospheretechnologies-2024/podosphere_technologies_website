import 'server-only';
import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

/** Default wall-clock timezone for India-first agencies (no per-client TZ stored yet). */
export const BEST_TIMES_DEFAULT_TIMEZONE = 'Asia/Kolkata';

function isValidTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const bestTimesQuerySchema = z.object({
  integrationId: z.string().min(1).max(64),
  timeZone: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => value || BEST_TIMES_DEFAULT_TIMEZONE)
    .refine(isValidTimeZone, 'Invalid IANA time zone'),
});

export type BestTimesQuery = z.infer<typeof bestTimesQuerySchema>;
