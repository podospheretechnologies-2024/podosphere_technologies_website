import 'server-only';
import { Redis } from 'ioredis';
import { getServerEnv } from './env';

function attachSilentErrorHandler(client: Redis): void {
  if (client.listenerCount('error') === 0) {
    client.on('error', () => {
      // Suppress unhandled connection errors (e.g. during next build).
    });
  }
}

// BullMQ needs its own connections: blocking worker commands must never time
// out, so maxRetriesPerRequest has to be null (unlike the shared `redis` client).
// Instantiated only when a queue/worker first calls this — never at module init.
export function createQueueConnection(): Redis {
  const client = new Redis(getServerEnv().REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
  attachSilentErrorHandler(client);
  return client;
}
