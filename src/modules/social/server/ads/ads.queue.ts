import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const ADS_QUEUE_NAME = 'social-ads-queue';

export const ADS_JOB = {
  syncStructure: 'meta.ads.structure',
  syncInsights: 'meta.ads.insights.daily',
};

let queue: Queue | undefined;

export function getAdsQueue() {
  if (!queue) {
    queue = new Queue(ADS_QUEUE_NAME, {
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

export async function closeAdsQueue() {
  await queue?.close();
  queue = undefined;
}
