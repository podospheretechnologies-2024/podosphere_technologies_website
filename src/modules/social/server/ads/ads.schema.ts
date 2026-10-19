import 'server-only';
import { z } from 'zod';
import { ADS_DATE_PRESETS, ADS_DEFAULT_DATE_PRESET, type AdsDatePreset } from '../../config/ads';

const presets = ADS_DATE_PRESETS.map((preset) => preset.value) as [string, ...string[]];
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export const adAccountIdSchema = z.string().regex(/^act_\d+$/, 'Invalid ad account id');

/** Admin/agency: set or rotate the Meta token for one ad account. */
export const adAccountTokenBodySchema = z.object({
  accessToken: z.string().min(20).max(4096),
});

export const adsEntityKindSchema = z.enum(['ad', 'campaign', 'adset']);
export const adsEntityIdSchema = z.string().min(1).max(64);

/** F14: generate draft ad creatives from brand kit (+ optional ad set context). Never publishes. */
export const adsCreativeHelperBodySchema = z.object({
  adAccountId: adAccountIdSchema,
  adSetId: z.string().min(1).max(64).optional(),
  adSetName: z.string().trim().max(512).optional(),
  campaignName: z.string().trim().max(512).optional(),
  objective: z.string().trim().max(120).optional(),
  /** Extra brief (offer, CTA, landing angle). Wrapped in <input> for Claude. */
  brief: z.string().trim().max(2000).optional(),
  /** When true (default), also return an F1-style image prompt. */
  includeImagePrompt: z.boolean().default(true),
});

export type AdsCreativeHelperBody = z.infer<typeof adsCreativeHelperBodySchema>;

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
