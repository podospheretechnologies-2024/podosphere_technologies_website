import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const ALERT_QUEUE_NAME = 'social-alert-queue';

export const ALERT_JOB = {
  evaluateRules: 'alerts.evaluate',
  slaSweep: 'alerts.slaSweep',
} as const;
// Monthly PDF reports: social-reports-queue / REPORT_JOB.generateMonthly.

let queue: Queue | undefined;

export function getAlertQueue() {
  if (!queue) {
    queue = new Queue(ALERT_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 * 60 },
        removeOnComplete: true,
      },
    });
  }
  return queue;
}

export async function closeAlertQueue() {
  await queue?.close();
  queue = undefined;
}
