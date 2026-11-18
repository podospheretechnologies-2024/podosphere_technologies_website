import 'server-only';
import { z } from 'zod';
import { PORTAL_ACCESS_LEVELS, PORTAL_TAB_IDS } from '../../config/portal-tabs';

/** `true` / `false` are still accepted from the old checkbox list: default level / hidden. */
const levelSchema = z.union([
  z.enum(PORTAL_ACCESS_LEVELS),
  z.boolean().transform((on) => (on ? ('act' as const) : ('off' as const))),
  z.null(),
]);

export const updatePortalTabsSchema = z.object({
  /** `null` removes the override, so the tab follows its connection default again. */
  tabs: z.partialRecord(z.enum(PORTAL_TAB_IDS), levelSchema).optional(),
  order: z.array(z.enum(PORTAL_TAB_IDS)).max(PORTAL_TAB_IDS.length).optional(),
  adSpendVisible: z.boolean().optional(),
});

export type UpdatePortalTabsBody = z.infer<typeof updatePortalTabsSchema>;

export const copyPortalTabsSchema = z.object({
  /** Clients that receive this client's tab settings. */
  targetClientIds: z.array(z.string().min(1)).min(1).max(500),
});

export type CopyPortalTabsBody = z.infer<typeof copyPortalTabsSchema>;
