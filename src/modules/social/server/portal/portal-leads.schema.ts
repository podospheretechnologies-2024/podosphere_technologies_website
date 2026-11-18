import 'server-only';
import { z } from 'zod';
import { LEAD_STAGES } from '../inbox/inbox.schema';

export const updatePortalLeadStageSchema = z.object({
  stage: z.enum(LEAD_STAGES),
});

export type UpdatePortalLeadStageBody = z.infer<typeof updatePortalLeadStageSchema>;
