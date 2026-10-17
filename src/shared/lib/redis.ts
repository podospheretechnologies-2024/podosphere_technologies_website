import 'server-only';
import { Redis } from 'ioredis';
import { getServerEnv } from './env';

const globalForRedis = globalThis as unknown as { redis?: Redis };

function attachSilentErrorHandler(client: Redis): void {
  // Connection failures emit 'error'; without a listener those become unhandled
  // rejections during `next build` when Redis is unreachable or never started.
  if (client.listenerCount('error') === 0) {
    client.on('error', () => {
      // Callers still see command failures; this only avoids process-level noise.
    });
  }
}

/** Shared Redis client — created on first use so importing this module never connects. */
export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    const client = new Redis(getServerEnv().REDIS_URL, { lazyConnect: true });
    attachSilentErrorHandler(client);
    globalForRedis.redis = client;
  }
  return globalForRedis.redis;
}

/**
 * Lazy proxy matching the previous `redis` export so call sites keep using
 * `redis.get` / `redis.set` without constructing a client at import time.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, property) {
    const client = getRedis();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
