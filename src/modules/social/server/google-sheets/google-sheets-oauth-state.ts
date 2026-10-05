import 'server-only';
import { randomToken } from '@/shared/lib/crypto';
import { redis } from '@/shared/lib/redis';

const STATE_TTL_SECONDS = 60 * 60;
const KEY_PREFIX = 'social:google-sheets-oauth:';

export const googleSheetsOAuthState = {
  async save(organizationId: string): Promise<string> {
    const state = randomToken(24);
    await redis.set(`${KEY_PREFIX}${state}`, organizationId, 'EX', STATE_TTL_SECONDS);
    return state;
  },

  async consume(state: string): Promise<string | null> {
    const organizationId = await redis.getdel(`${KEY_PREFIX}${state}`);
    return organizationId || null;
  },
};
