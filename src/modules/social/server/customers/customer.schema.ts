import 'server-only';
import { z } from 'zod';
import { adAccountIdSchema } from '../ads/ads.schema';
import { googleAdsCustomerIdSchema } from '../google-ads/google-ads.schema';

const integrationIdSchema = z.string().min(1).max(64);

function uniqueIds<T extends string>(ids: T[]): T[] {
  return [...new Set(ids)];
}

const emptyToUndefined = z.literal('').transform(() => undefined);

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  approverName: z.string().trim().min(1).max(120),
  approverEmail: z.string().trim().email().max(320),
  integrationIds: z.array(integrationIdSchema).max(50).optional(),
  adAccountIds: z.array(adAccountIdSchema).max(50).optional(),
  googleAdAccountIds: z.array(googleAdsCustomerIdSchema).max(50).optional(),
  /** Older single-select form field. */
  integrationId: z.union([integrationIdSchema, emptyToUndefined]).optional(),
  /** Older single-select form field (Meta `act_…`). */
  adAccountId: z.union([adAccountIdSchema, emptyToUndefined]).optional(),
});

export const updateClientLinksSchema = z.object({
  integrationIds: z.array(integrationIdSchema).max(50).optional(),
  adAccountIds: z.array(adAccountIdSchema).max(50).optional(),
  googleAdAccountIds: z.array(googleAdsCustomerIdSchema).max(50).optional(),
});

export type CreateClientBody = z.infer<typeof createClientSchema>;
export type UpdateClientLinksBody = z.infer<typeof updateClientLinksSchema>;

export interface ClientAssetLinks {
  integrationIds: string[];
  adAccountIds: string[];
  googleAdAccountIds: string[];
}

function presentIds(...groups: Array<string | undefined | Array<string | undefined>>): string[] {
  return uniqueIds(
    groups.flatMap((group) => (Array.isArray(group) ? group : [group])).filter((id): id is string => Boolean(id))
  );
}

export function clientLinksFromCreate(body: CreateClientBody): ClientAssetLinks {
  return {
    integrationIds: presentIds(body.integrationIds, body.integrationId),
    adAccountIds: presentIds(body.adAccountIds, body.adAccountId),
    googleAdAccountIds: presentIds(body.googleAdAccountIds),
  };
}
