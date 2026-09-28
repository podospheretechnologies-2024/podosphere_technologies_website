import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { autopostService } from '../autoposts/autopost.service';
import { webhookService } from '../webhooks/webhook.service';
import {
  AUTOMATION_JOB,
  AUTOMATION_QUEUE_NAME,
  closeAutomationQueue,
  getAutomationQueue,
  type RunAutopostJobData,
  type SendWebhookJobData,
} from './automation.queue';

const AUTOPOST_SWEEP_EVERY_MS = 15 * 60 * 1000;
const CONCURRENCY = 5;

function processJob(job: Job) {
  switch (job.name) {
    case AUTOMATION_JOB.sendWebhook:
      return webhookService.send(job.data as SendWebhookJobData);
    case AUTOMATION_JOB.autopostSweep:
      return autopostService.sweep();
    case AUTOMATION_JOB.runAutopost:
      return autopostService.runScheduled((job.data as RunAutopostJobData).autopostId);
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

// Runs in the worker process (`pnpm worker`), never inside Next.js.
export async function startAutomationWorker(): Promise<{ close(): Promise<void> }> {
  await getAutomationQueue().upsertJobScheduler(
    AUTOMATION_JOB.autopostSweep,
    { every: AUTOPOST_SWEEP_EVERY_MS },
    { name: AUTOMATION_JOB.autopostSweep }
  );

  const worker = new Worker(AUTOMATION_QUEUE_NAME, processJob, {
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
    console.error('[social] automation worker error', error);
  });

  return {
    async close() {
      await worker.close();
      await closeAutomationQueue();
    },
  };
}
