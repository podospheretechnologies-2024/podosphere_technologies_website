import 'server-only';
import { z } from 'zod';
import { ADS_DATE_PRESETS, ADS_DEFAULT_DATE_PRESET } from '../../config/ads';

const presets = ADS_DATE_PRESETS.map((preset) => preset.value) as [string, ...string[]];

export const adAccountIdSchema = z.string().regex(/^act_\d+$/, 'Invalid ad account id');

export const adsOverviewQuerySchema = z.object({
  datePreset: z.enum(presets).default(ADS_DEFAULT_DATE_PRESET),
});
