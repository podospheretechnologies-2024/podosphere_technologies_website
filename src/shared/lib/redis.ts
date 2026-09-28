import 'server-only';
import { Redis } from 'ioredis';
import { getServerEnv } from './env';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis = globalForRedis.redis ?? new Redis(getServerEnv().REDIS_URL);

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
