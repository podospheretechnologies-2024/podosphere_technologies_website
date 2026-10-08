import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const ANALYTICS_QUEUE_NAME = 'social-analytics-queue';

export const ANALYTICS_JOB = {
  syncPosts: 'meta.posts.sync',
  syncPostMetrics: 'meta.post-metrics.sync',
  captureStories: 'meta.stories.capture',
  syncDailyInsights: 'meta.insights.daily',
  backfill: 'meta.backfill',
};

let queue: Queue | undefined;

export function getAnalyticsQueue() {
  if (!queue) {
    queue = new Queue(ANALYTICS_QUEUE_NAME, {
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

export async function closeAnalyticsQueue() {
  await queue?.close();
  queue = undefined;
}
