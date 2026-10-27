import { z } from 'zod';

/** Meta often returns money/metric fields as strings; accept numbers too. */
const graphString = z.union([z.string(), z.number()]).transform(String);

const optionalGraphString = graphString.optional().catch(undefined);

export const adCampaignNodeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional().catch(undefined),
    effective_status: z.string().optional().catch(undefined),
    objective: z.string().optional().catch(undefined),
    daily_budget: optionalGraphString,
  })
  .passthrough();

export const adSetNodeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional().catch(undefined),
    effective_status: z.string().optional().catch(undefined),
    campaign_id: z.string().optional().catch(undefined),
  })
  .passthrough();

export const adNodeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional().catch(undefined),
    effective_status: z.string().optional().catch(undefined),
    adset_id: z.string().optional().catch(undefined),
    campaign_id: z.string().optional().catch(undefined),
  })
  .passthrough();

const adInsightActionSchema = z
  .object({
    action_type: z.string().catch(''),
    value: graphString.catch('0'),
  })
  .passthrough();

export const adInsightRowSchema = z
  .object({
    campaign_id: z.string().optional().catch(undefined),
    adset_id: z.string().optional().catch(undefined),
    ad_id: z.string().optional().catch(undefined),
    date_start: z.string().optional().catch(undefined),
    spend: optionalGraphString,
    impressions: optionalGraphString,
    reach: optionalGraphString,
    clicks: optionalGraphString,
    cpc: optionalGraphString,
    ctr: optionalGraphString,
    frequency: optionalGraphString,
    actions: z.array(adInsightActionSchema).optional().catch(undefined),
  })
  .passthrough();

export type AdCampaignNode = z.infer<typeof adCampaignNodeSchema>;
export type AdSetNode = z.infer<typeof adSetNodeSchema>;
export type AdNode = z.infer<typeof adNodeSchema>;
export type AdInsightRow = z.infer<typeof adInsightRowSchema>;
