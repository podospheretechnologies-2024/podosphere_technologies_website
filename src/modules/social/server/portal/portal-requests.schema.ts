import 'server-only';
import { z } from 'zod';

export const PORTAL_REQUEST_TYPES = ['post', 'campaign', 'change', 'other'] as const;
export const PORTAL_REQUEST_STATUSES = ['open', 'in_progress', 'done', 'declined'] as const;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

export const createPortalRequestSchema = z.object({
  type: z.enum(PORTAL_REQUEST_TYPES),
  title: z.string().trim().min(3, 'Give it a short title').max(200),
  detail: z.string().trim().max(4000).optional(),
});

/** Calendar "request a post" — always stored as type `post` for the agency Requests list. */
export const createPortalPostRequestSchema = z.object({
  title: z.string().trim().min(3, 'Give it a short title').max(200),
  brief: z.string().trim().max(4000).optional(),
  dueDate: day.optional(),
});

export const updatePortalRequestSchema = z.object({
  status: z.enum(PORTAL_REQUEST_STATUSES).optional(),
  reply: z.string().trim().max(2000).nullable().optional(),
});

export type CreatePortalRequestBody = z.infer<typeof createPortalRequestSchema>;
export type CreatePortalPostRequestBody = z.infer<typeof createPortalPostRequestSchema>;
export type UpdatePortalRequestBody = z.infer<typeof updatePortalRequestSchema>;
