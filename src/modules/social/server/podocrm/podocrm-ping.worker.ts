import 'server-only';
import { Queue, Worker } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { podoCrmWhatsAppSyncService } from './podocrm-whatsapp-sync.service';

const QUEUE_NAME = 'social-podocrm-ping-queue';
const JOB_PING_ALL = 'podocrm.ping.daily';
const PING_EVERY_MS = 24 * 60 * 60 * 1000;

/** Daily PodoCRM keep-alive ping so `lastPingAt` reflects the link's real health (PS-27b). */
export async function startPodoCrmPingWorker(): Promise<{ close(): Promise<void> }> {
  const queue = new Queue(QUEUE_NAME, {
    connection: createQueueConnection(),
    defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 60_000 }, removeOnComplete: true, removeOnFail: 50 },
  });
  await queue.upsertJobScheduler(JOB_PING_ALL, { every: PING_EVERY_MS }, { name: JOB_PING_ALL });

  const worker = new Worker(QUEUE_NAME, () => podoCrmWhatsAppSyncService.pingAll(), {
    connection: createQueueConnection(),
    concurrency: 1,
  });
  worker.on('failed', (job, error) => console.error(`[podocrm-ping-worker] ${job?.name} failed: ${error.message}`));
  worker.on('error', (error) => console.error('[podocrm-ping-worker] error', error));

  return {
    async close() {
      await worker.close();
      await queue.close();
    },
  };
}
