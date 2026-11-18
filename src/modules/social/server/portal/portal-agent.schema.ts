import 'server-only';
import { z } from 'zod';

export const portalAgentMessageSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  /** When omitted, a new thread is created for this client before sending. */
  threadId: z.string().uuid().optional(),
});

export const portalAgentCreateThreadSchema = z.object({
  title: z.string().trim().max(200).optional(),
});
