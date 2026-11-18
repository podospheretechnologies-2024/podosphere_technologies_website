import { z } from 'zod';

export const portalGrowthCampaignDecideSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  feedback: z.string().trim().max(2000).optional().nullable(),
});

export const portalGrowthBlogDecideSchema = z.object({
  action: z.enum(['approve', 'changes']),
  feedback: z.string().trim().max(2000).optional().nullable(),
});

export const portalGrowthIdeaCreateSchema = z.object({
  ask: z.string().trim().min(3, 'Write a short idea').max(4000),
  area: z.string().trim().max(40).optional(),
});

export type PortalGrowthCampaignDecideBody = z.infer<typeof portalGrowthCampaignDecideSchema>;
export type PortalGrowthBlogDecideBody = z.infer<typeof portalGrowthBlogDecideSchema>;
export type PortalGrowthIdeaCreateBody = z.infer<typeof portalGrowthIdeaCreateSchema>;
