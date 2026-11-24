import 'server-only';
import { z } from 'zod';
import { redis } from '@/shared/lib/redis';

const PENDING_TTL_SECONDS = 15 * 60;
const PENDING_PREFIX = 'social:meta-pages-pending:';

const pendingAccountSchema = z.object({
  internalId: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  picture: z.string().nullable(),
  accessTokenEncrypted: z.string(),
  refreshTokenEncrypted: z.string().nullable(),
  tokenExpiration: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const pendingSchema = z.object({
  organizationId: z.string(),
  providerIdentifier: z.string(),
  customerId: z.string().nullable().optional(),
  accounts: z.array(pendingAccountSchema),
});

export type MetaPagesPendingAccount = z.infer<typeof pendingAccountSchema>;
export type MetaPagesPending = z.infer<typeof pendingSchema>;

/** Holds encrypted Page tokens between Meta OAuth and the pick-and-save step. */
export const metaPagesPendingStore = {
  async save(organizationId: string, data: MetaPagesPending): Promise<void> {
    await redis.set(
      `${PENDING_PREFIX}${organizationId}`,
      JSON.stringify(data),
      'EX',
      PENDING_TTL_SECONDS
    );
  },

  async get(organizationId: string): Promise<MetaPagesPending | null> {
    const raw = await redis.get(`${PENDING_PREFIX}${organizationId}`);
    if (!raw) return null;
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },

  async consume(organizationId: string): Promise<MetaPagesPending | null> {
    const raw = await redis.getdel(`${PENDING_PREFIX}${organizationId}`);
    if (!raw) return null;
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },
};
