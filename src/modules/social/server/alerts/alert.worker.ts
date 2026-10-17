import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getAlertQueue, closeAlertQueue, ALERT_JOB, ALERT_QUEUE_NAME } from './alert.queue';
import { alertService } from './alert.service';

const EVALUATE_ALERTS_EVERY_MS = 60 * 60 * 1000; // Hourly
const SLA_SWEEP_EVERY_MS = 5 * 60 * 1000; // Every 5 minutes

function processJob(job: Job) {
  switch (job.name) {
    case ALERT_JOB.evaluateRules:
      return alertService.runAllAlerts();
    case ALERT_JOB.slaSweep:
      return alertService.evaluateSlaBreaches();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startAlertWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getAlertQueue();
  
  await queue.upsertJobScheduler(
    ALERT_JOB.evaluateRules,
    { every: EVALUATE_ALERTS_EVERY_MS },
    { name: ALERT_JOB.evaluateRules }
  );
  await queue.upsertJobScheduler(
    ALERT_JOB.slaSweep,
    { every: SLA_SWEEP_EVERY_MS },
    { name: ALERT_JOB.slaSweep }
  );
  const worker = new Worker(ALERT_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: 2,
  });

  worker.on('failed', (job, error) => {
    console.error(`[alert-worker] ${job?.name} failed: ${error.message}`);
  });

  return {
    async close() {
      await worker.close();
      await closeAlertQueue();
    },
  };
}
