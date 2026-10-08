import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getAnalyticsQueue, closeAnalyticsQueue, ANALYTICS_JOB, ANALYTICS_QUEUE_NAME } from './analytics.queue';

const SYNC_POSTS_EVERY_MS = 2 * 60 * 60 * 1000;
const SYNC_POST_METRICS_EVERY_MS = 6 * 60 * 60 * 1000;
const CAPTURE_STORIES_EVERY_MS = 4 * 60 * 60 * 1000;
const SYNC_DAILY_INSIGHTS_EVERY_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 3;

async function syncPosts() {
  console.log('[analytics-worker] Syncing posts (external posts + basic counts)...');
}

async function syncPostMetrics() {
  console.log('[analytics-worker] Syncing post metrics (reach, impressions, saves)...');
}

async function captureStories() {
  console.log('[analytics-worker] Capturing live stories...');
}

async function syncDailyInsights() {
  console.log('[analytics-worker] Syncing daily insights (followers, profile views)...');
}

function processJob(job: Job) {
  switch (job.name) {
    case ANALYTICS_JOB.syncPosts:
      return syncPosts();
    case ANALYTICS_JOB.syncPostMetrics:
      return syncPostMetrics();
    case ANALYTICS_JOB.captureStories:
      return captureStories();
    case ANALYTICS_JOB.syncDailyInsights:
      return syncDailyInsights();
    case ANALYTICS_JOB.backfill:
      console.log('[analytics-worker] Running channel backfill...');
      return Promise.resolve();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startAnalyticsWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getAnalyticsQueue();
  await queue.upsertJobScheduler(
    ANALYTICS_JOB.syncPosts,
    { every: SYNC_POSTS_EVERY_MS },
    { name: ANALYTICS_JOB.syncPosts }
  );
  await queue.upsertJobScheduler(
    ANALYTICS_JOB.syncPostMetrics,
    { every: SYNC_POST_METRICS_EVERY_MS },
    { name: ANALYTICS_JOB.syncPostMetrics }
  );
  await queue.upsertJobScheduler(
    ANALYTICS_JOB.captureStories,
    { every: CAPTURE_STORIES_EVERY_MS },
    { name: ANALYTICS_JOB.captureStories }
  );
  // Ideally this is cron-based at 03:00, but an interval scheduler is a good fallback
  await queue.upsertJobScheduler(
    ANALYTICS_JOB.syncDailyInsights,
    { every: SYNC_DAILY_INSIGHTS_EVERY_MS },
    { name: ANALYTICS_JOB.syncDailyInsights }
  );

  const worker = new Worker(ANALYTICS_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: CONCURRENCY,
  });

  worker.on('completed', (job, result) => {
    console.log(`[analytics-worker] ${job.name} completed`);
  });
  worker.on('failed', (job, error) => {
    console.error(`[analytics-worker] ${job?.name} failed: ${error.message}`);
  });

  return {
    async close() {
      await worker.close();
      await closeAnalyticsQueue();
    },
  };
}
