import 'server-only';
import { z } from 'zod';
import { AI_PROVIDERS } from '../../config/ai';

export const portalAgentMessageSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  /** When omitted, a new thread is created for this client before sending. */
  threadId: z.string().uuid().optional(),
});

export const portalAgentCreateThreadSchema = z.object({
  title: z.string().trim().max(200).optional(),
});

/** Client BYO key — first save must include apiKey (mandatory for every client). */
export const portalAgentProviderSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().trim().max(64).optional(),
  apiKey: z.string().trim().min(1).max(500).optional(),
});
