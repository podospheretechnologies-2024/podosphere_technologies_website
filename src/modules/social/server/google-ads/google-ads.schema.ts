import 'server-only';
import { z } from 'zod';

export const googleAdsCustomerIdSchema = z.string().regex(/^\d{10}$/, 'Invalid Google Ads customer id');

/** Admin: assign (or clear) the Podo client an account belongs to. */
export const googleAdsAssignBodySchema = z.object({
  clientId: z.string().min(1).max(64).nullable(),
});
