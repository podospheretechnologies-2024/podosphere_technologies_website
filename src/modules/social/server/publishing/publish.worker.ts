import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { integrationService } from '../integrations/integration.service';
import {
  closePublishQueue,
  getPublishQueue,
  PUBLISH_JOB,
  PUBLISH_QUEUE_NAME,
  type PublishPostJobData,
} from './publish.queue';
import { publishService } from './publish.service';

const SWEEP_EVERY_MS = 5 * 60 * 1000;
const REFRESH_TOKENS_EVERY_MS = 60 * 60 * 1000;
const CONCURRENCY = 5;

function processJob(job: Job) {
  switch (job.name) {
    case PUBLISH_JOB.post:
      return publishService.publish(
        job.data as PublishPostJobData,
        job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
      );
    case PUBLISH_JOB.sweep:
      return publishService.sweep();
    case PUBLISH_JOB.refreshTokens:
      return integrationService.refreshExpiringTokens();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

// Runs in the worker process (`pnpm worker`), never inside Next.js.
export async function startPublishWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getPublishQueue();
  await queue.upsertJobScheduler(
    PUBLISH_JOB.sweep,
    { every: SWEEP_EVERY_MS },
    { name: PUBLISH_JOB.sweep }
  );
  await queue.upsertJobScheduler(
    PUBLISH_JOB.refreshTokens,
    { every: REFRESH_TOKENS_EVERY_MS },
    { name: PUBLISH_JOB.refreshTokens }
  );

  const worker = new Worker(PUBLISH_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: CONCURRENCY,
  });

  worker.on('completed', (job, result) => {
    console.log(`[social] ${job.name} ${job.id} -> ${JSON.stringify(result)}`);
  });
  worker.on('failed', (job, error) => {
    console.error(`[social] ${job?.name} ${job?.id} failed: ${error.message}`);
  });
  worker.on('error', (error) => {
    console.error('[social] worker error', error);
  });

  return {
    async close() {
      await worker.close();
      await closePublishQueue();
    },
  };
}
