import 'server-only';
import { z } from 'zod';
import { randomToken } from '@/shared/lib/crypto';
import { redis } from '@/shared/lib/redis';

const STATE_TTL_SECONDS = 60 * 60;
const PENDING_TTL_SECONDS = 15 * 60;
const STATE_PREFIX = 'social:meta-ads-oauth:';
const PENDING_PREFIX = 'social:meta-ads-pending:';

const stateSchema = z.object({
  organizationId: z.string(),
  customerId: z.string().optional(),
});

const pendingAccountSchema = z.object({
  id: z.string(),
  accountId: z.string().optional(),
  name: z.string(),
  currency: z.string(),
  accountStatus: z.number(),
  businessName: z.string().nullable().optional(),
  timezoneName: z.string().optional(),
});

const pendingSchema = z.object({
  organizationId: z.string(),
  customerId: z.string().nullable().optional(),
  /** AES-GCM encrypted long-lived user token — never returned to the browser. */
  accessTokenEncrypted: z.string(),
  accounts: z.array(pendingAccountSchema),
});

export type MetaAdsOAuthState = z.infer<typeof stateSchema>;
export type MetaAdsPendingAccount = z.infer<typeof pendingAccountSchema>;
export type MetaAdsPending = z.infer<typeof pendingSchema>;

export const metaAdsOAuthState = {
  async save(data: MetaAdsOAuthState): Promise<string> {
    const state = randomToken(24);
    await redis.set(`${STATE_PREFIX}${state}`, JSON.stringify(data), 'EX', STATE_TTL_SECONDS);
    return state;
  },

  async consume(state: string): Promise<MetaAdsOAuthState | null> {
    const raw = await redis.getdel(`${STATE_PREFIX}${state}`);
    if (!raw) return null;
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },
};

/** Holds the user token + ad account list between OAuth callback and the pick-and-save step. */
export const metaAdsPendingStore = {
  async save(organizationId: string, data: MetaAdsPending): Promise<void> {
    await redis.set(
      `${PENDING_PREFIX}${organizationId}`,
      JSON.stringify(data),
      'EX',
      PENDING_TTL_SECONDS
    );
  },

  async get(organizationId: string): Promise<MetaAdsPending | null> {
    const raw = await redis.get(`${PENDING_PREFIX}${organizationId}`);
    if (!raw) return null;
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },

  async consume(organizationId: string): Promise<MetaAdsPending | null> {
    const raw = await redis.getdel(`${PENDING_PREFIX}${organizationId}`);
    if (!raw) return null;
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },
};
