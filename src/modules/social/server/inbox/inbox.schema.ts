import { z } from 'zod';

export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const DEFAULT_INBOX_SLA_HOURS = 4;

export const assignThreadSchema = z.object({
  assigneeId: z.string().uuid().nullable().optional(),
  slaDueAt: z.string().datetime().nullable().optional(),
});

export const updateLeadStageSchema = z.object({
  stage: z.enum(LEAD_STAGES),
});
