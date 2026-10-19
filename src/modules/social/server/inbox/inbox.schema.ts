import { z } from 'zod';

export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const INBOX_TRIAGE_LABELS = [
  'question',
  'complaint',
  'lead',
  'spam',
  'praise',
  'other',
] as const;
export type InboxTriageLabel = (typeof INBOX_TRIAGE_LABELS)[number];

export const INBOX_TRIAGE_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type InboxTriagePriority = (typeof INBOX_TRIAGE_PRIORITIES)[number];

export const INBOX_TRIAGE_SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
export type InboxTriageSentiment = (typeof INBOX_TRIAGE_SENTIMENTS)[number];

export const DEFAULT_INBOX_SLA_HOURS = 4;

export const assignThreadSchema = z.object({
  assigneeId: z.string().uuid().nullable().optional(),
  slaDueAt: z.string().datetime().nullable().optional(),
});

export const replyThreadSchema = z.object({
  text: z.string().trim().min(1, 'Reply text is required').max(8000),
});

export const triageThreadSchema = z.object({
  /** When false, classify only (no draftReply). Default true. */
  includeDraft: z.boolean().optional().default(true),
});

export const triageResultSchema = z.object({
  label: z.enum(INBOX_TRIAGE_LABELS),
  priority: z.enum(INBOX_TRIAGE_PRIORITIES),
  sentiment: z.enum(INBOX_TRIAGE_SENTIMENTS),
  draftReply: z.string(),
});

export const updateLeadStageSchema = z.object({
  stage: z.enum(LEAD_STAGES),
});

export const scoreLeadSchema = z.object({
  /** When true, also push the scored lead to PodoCRM if linked. Default false. */
  pushToCrm: z.boolean().optional().default(false),
});
