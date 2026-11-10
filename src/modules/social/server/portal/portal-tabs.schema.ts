import 'server-only';
import { z } from 'zod';
import { PORTAL_TAB_IDS } from '../../config/portal-tabs';

const tabOverrideSchema = z.partialRecord(z.enum(PORTAL_TAB_IDS), z.boolean()).optional();

export const updatePortalTabsSchema = z.object({
  tabs: tabOverrideSchema,
  adSpendVisible: z.boolean().optional(),
});

export type UpdatePortalTabsBody = z.infer<typeof updatePortalTabsSchema>;
