import 'server-only';
import { z } from 'zod';
import { redis } from '@/shared/lib/redis';

const STATE_TTL_SECONDS = 60 * 60;
const KEY_PREFIX = 'social:oauth-state:';

const oauthStateSchema = z.object({
  organizationId: z.string(),
  providerIdentifier: z.string(),
  codeVerifier: z.string(),
  refreshIntegrationId: z.string().optional(),
  customerId: z.string().optional(),
});

export type OAuthState = z.infer<typeof oauthStateSchema>;

export const oauthStateStore = {
  async save(state: string, data: OAuthState): Promise<void> {
    await redis.set(`${KEY_PREFIX}${state}`, JSON.stringify(data), 'EX', STATE_TTL_SECONDS);
  },

  // Single use: the state is deleted as it is read so a callback URL cannot be replayed.
  async consume(state: string): Promise<OAuthState | null> {
    const raw = await redis.getdel(`${KEY_PREFIX}${state}`);
    if (!raw) {
      return null;
    }
    const parsed = oauthStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },
};
