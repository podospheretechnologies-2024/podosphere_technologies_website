import 'server-only';
import { z } from 'zod';
import { ADS_DATE_PRESETS, ADS_DEFAULT_DATE_PRESET, type AdsDatePreset } from '../../config/ads';

const presets = ADS_DATE_PRESETS.map((preset) => preset.value) as [string, ...string[]];
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export const adAccountIdSchema = z.string().regex(/^act_\d+$/, 'Invalid ad account id');

export const adsEntityKindSchema = z.enum(['ad', 'campaign', 'adset']);
export const adsEntityIdSchema = z.string().min(1).max(64);

export type AdsOverviewDateQuery =
  | { mode: 'preset'; datePreset: AdsDatePreset }
  | { mode: 'range'; since: string; until: string };

export const adsOverviewQuerySchema = z
  .object({
    datePreset: z.enum(presets).optional(),
    since: dateString.optional(),
    until: dateString.optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.since) !== Boolean(value.until)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Both since and until are required for a custom date range',
        path: value.since ? ['until'] : ['since'],
      });
    }
    if (value.since && value.until && value.since > value.until) {
      ctx.addIssue({
        code: 'custom',
        message: 'since must be on or before until',
        path: ['since'],
      });
    }
  })
  .transform((value): AdsOverviewDateQuery => {
    if (value.since && value.until) {
      return { mode: 'range', since: value.since, until: value.until };
    }
    return {
      mode: 'preset',
      datePreset: (value.datePreset ?? ADS_DEFAULT_DATE_PRESET) as AdsDatePreset,
    };
  });
