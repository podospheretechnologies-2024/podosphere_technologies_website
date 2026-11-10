import { z } from 'zod';
import { TASK_AREAS, TASK_PRIORITIES } from './tasks.service';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === '' || /^https:\/\//.test(v) || v.startsWith('/'), 'Links must start with https://')
  .nullish();

export const settingsSchema = z.object({
  targetRoas: z.number().min(0.1).max(100).optional(),
  dailyBudget: z.number().min(0).max(100_000_000).nullable().optional(),
  budgetCap: z.number().min(0).max(100_000_000).nullable().optional(),
  blogsPerMonth: z.number().int().min(0).max(31).optional(),
  reportEveryDays: z.number().int().min(7).max(31).optional(),
  contentSheetUrl: httpsUrl,
  brandContext: optionalText(4000),
  insightsEnabled: z.boolean().optional(),
});

export const shopifyConnectSchema = z.object({
  shopDomain: z.string().trim().min(3).max(255),
  accessToken: z.string().trim().max(512).optional(),
  clientId: z.string().trim().max(255).optional(),
  clientSecret: z.string().trim().max(512).optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(2).max(255),
  detail: optionalText(8000),
  area: z.enum(TASK_AREAS).default('ads'),
  priority: z.enum(TASK_PRIORITIES).default('med'),
  dueDate: day.nullish(),
  assigneeId: z.string().max(191).nullish(),
  link: httpsUrl,
});

export const taskUpdateSchema = z.object({
  action: z.enum(['complete', 'approve', 'send_back', 'reopen']).optional(),
  note: optionalText(4000),
  title: z.string().trim().min(2).max(255).optional(),
  detail: optionalText(8000),
  area: z.enum(TASK_AREAS).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: day.nullish(),
  assigneeId: z.string().max(191).nullish(),
  link: httpsUrl,
});

export const changeLogSchema = z.object({
  place: z.string().trim().min(1).max(255),
  what: z.string().trim().min(1).max(4000),
  why: optionalText(4000),
  byName: optionalText(120),
});

export const adPlanItemSchema = z.object({
  campaignName: z.string().trim().min(1).max(255),
  objective: optionalText(120),
  budgetNote: optionalText(255),
  adsetName: z.string().trim().min(1).max(255),
  audience: optionalText(4000),
  adName: z.string().trim().min(1).max(255),
  format: optionalText(120),
  hook: optionalText(2000),
  primaryText: optionalText(4000),
  headline: optionalText(255),
  description: optionalText(512),
  cta: optionalText(64),
  landingPage: httpsUrl,
  product: optionalText(255),
  placements: optionalText(255),
  imageNote: optionalText(2000),
  imageUrl: httpsUrl,
  rationale: optionalText(4000),
});

export const adPlanCreateSchema = z.union([
  z.object({ generate: z.literal(true), brief: optionalText(2000) }),
  z.object({ generate: z.literal(false).optional(), item: adPlanItemSchema }),
]);

export const adPlanDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'live', 'pending']),
  feedback: optionalText(4000),
});

export const blogCreateSchema = z.union([
  z.object({ generate: z.literal(true) }),
  z.object({
    generate: z.literal(false).optional(),
    title: z.string().trim().min(3).max(255),
    angle: optionalText(2000),
    keywords: optionalText(512),
  }),
]);

export const blogUpdateSchema = z.object({
  title: z.string().trim().min(3).max(255).optional(),
  slug: optionalText(255),
  metaDescription: optionalText(512),
  keywords: optionalText(512),
  bodyHtml: z.string().max(200_000).nullish(),
  coverImageUrl: httpsUrl,
  status: z.enum(['idea', 'draft', 'changes', 'approved', 'rejected']).optional(),
  feedback: optionalText(4000),
  writeNext: z.boolean().optional(),
});

export const briefSchema = z.object({
  area: z.string().trim().min(1).max(40),
  ask: z.string().trim().min(3).max(4000),
});

export const boostSchema = z.object({
  boost: z.boolean(),
  budget: z.number().min(0).max(100_000_000).nullish(),
  spend: z.number().min(0).max(100_000_000).nullish(),
  note: optionalText(2000),
});

/** Assign (or clear with null) the GA4 property of the selected client. Numeric property id. */
export const ga4AssignSchema = z.object({
  propertyId: z.string().regex(/^\d{1,20}$/, 'Invalid GA4 property id').nullable(),
});

export const contentSheetLinkSchema = z.object({
  link: z.string().trim().max(2048).nullable(),
  tab: z.string().trim().max(191).nullish(),
});
