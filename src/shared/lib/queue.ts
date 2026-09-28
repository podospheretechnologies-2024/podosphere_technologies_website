import 'server-only';
import { Redis } from 'ioredis';
import { getServerEnv } from './env';

// BullMQ needs its own connections: blocking worker commands must never time
// out, so maxRetriesPerRequest has to be null (unlike the shared `redis` client).
export function createQueueConnection(): Redis {
  return new Redis(getServerEnv().REDIS_URL, { maxRetriesPerRequest: null });
}
