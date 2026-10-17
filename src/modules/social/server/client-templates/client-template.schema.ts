import { z } from 'zod';
import { ONBOARDING_STEPS } from '../../config/client-onboarding';

const postingHintSchema = z.object({ time: z.number().int().min(0).max(1439) });

const templateDataSchema = z.object({
  brandKit: z.record(z.string(), z.string()).nullable().optional(),
  tags: z
    .array(z.object({ name: z.string().trim().min(1).max(120), color: z.string().trim().min(1).max(32) }))
    .optional(),
  signatures: z
    .array(z.object({ content: z.string().min(1), autoAdd: z.boolean().default(false) }))
    .optional(),
  sets: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        content: z.unknown(),
        channelProviders: z.array(z.string().min(1)).optional(),
      })
    )
    .optional(),
  postingScheduleHints: z.array(postingHintSchema).optional(),
  sourceChannels: z
    .array(
      z.object({
        id: z.string().min(1),
        providerIdentifier: z.string().min(1),
      })
    )
    .optional(),
});

export const saveTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    sourceCustomerId: z.string().uuid().optional(),
    data: templateDataSchema.optional(),
  })
  .refine((v) => Boolean(v.sourceCustomerId) || v.data != null, {
    message: 'Provide sourceCustomerId or data',
  });

export const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  approverName: z.string().trim().min(1).max(120),
  approverEmail: z.string().trim().email().max(320),
});

export const onboardingStepSchema = z.object({
  step: z.enum(ONBOARDING_STEPS),
});

export type SaveTemplateBody = z.infer<typeof saveTemplateSchema>;
export type ApplyTemplateBody = z.infer<typeof applyTemplateSchema>;
