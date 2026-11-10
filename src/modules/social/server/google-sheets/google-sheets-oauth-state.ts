import 'server-only';
import { randomToken } from '@/shared/lib/crypto';
import { redis } from '@/shared/lib/redis';

const STATE_TTL_SECONDS = 60 * 60;
const KEY_PREFIX = 'social:google-sheets-oauth:';

/** Where the callback sends the user back to. */
export type GoogleSheetsReturnTo = 'automation' | 'growth';

export const googleSheetsOAuthState = {
  async save(organizationId: string, returnTo: GoogleSheetsReturnTo = 'automation'): Promise<string> {
    const state = randomToken(24);
    await redis.set(`${KEY_PREFIX}${state}`, JSON.stringify({ o: organizationId, r: returnTo }), 'EX', STATE_TTL_SECONDS);
    return state;
  },

  async consume(state: string): Promise<{ organizationId: string; returnTo: GoogleSheetsReturnTo } | null> {
    const raw = await redis.getdel(`${KEY_PREFIX}${state}`);
    if (!raw) return null;
    // States saved before the returnTo change hold the bare organization id.
    if (!raw.startsWith('{')) return { organizationId: raw, returnTo: 'automation' };
    try {
      const parsed = JSON.parse(raw) as { o?: string; r?: string };
      if (!parsed.o) return null;
      return { organizationId: parsed.o, returnTo: parsed.r === 'growth' ? 'growth' : 'automation' };
    } catch {
      return null;
    }
  },
};
