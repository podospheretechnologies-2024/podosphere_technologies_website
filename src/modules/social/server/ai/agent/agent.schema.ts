import 'server-only';
import { z } from 'zod';

export const createThreadBodySchema = z.object({
  title: z.string().trim().max(200).optional(),
});

export const postMessageBodySchema = z.object({
  message: z.string().trim().min(1).max(8000),
});

export const ACTION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type AiActionStatus = (typeof ACTION_STATUSES)[number];

export const WRITE_TOOL_NAMES = ['create_post_draft', 'reply_to_conversation'] as const;
export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number];

export const READ_TOOL_NAMES = ['get_analytics', 'list_scheduled_posts', 'list_leads'] as const;
export type ReadToolName = (typeof READ_TOOL_NAMES)[number];
