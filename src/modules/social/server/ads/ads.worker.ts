import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getAdsQueue, closeAdsQueue, ADS_JOB, ADS_QUEUE_NAME } from './ads.queue';
import { prisma } from '@/shared/lib/prisma';

// 2 hours for structure (campaigns/adsets/ads)
const SYNC_STRUCTURE_EVERY_MS = 2 * 60 * 60 * 1000;
// 1 hour for today's insights
const SYNC_INSIGHTS_EVERY_MS = 1 * 60 * 60 * 1000;
const CONCURRENCY = 2;

async function syncStructure() {
  console.log('[ads-worker] Syncing ad structure (campaigns, ad sets, ads)...');
  // Implementation will iterate over prisma.adAccount and fetch hierarchy from Meta
  // then upsert into AdEntity.
}

async function syncInsights() {
  console.log('[ads-worker] Syncing ad insights...');
  // Implementation will iterate over active campaigns and fetch insights
  // then upsert into AdInsightDaily.
}

function processJob(job: Job) {
  switch (job.name) {
    case ADS_JOB.syncStructure:
      return syncStructure();
    case ADS_JOB.syncInsights:
      return syncInsights();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startAdsWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getAdsQueue();
  await queue.upsertJobScheduler(
    ADS_JOB.syncStructure,
    { every: SYNC_STRUCTURE_EVERY_MS },
    { name: ADS_JOB.syncStructure }
  );
  await queue.upsertJobScheduler(
    ADS_JOB.syncInsights,
    { every: SYNC_INSIGHTS_EVERY_MS },
    { name: ADS_JOB.syncInsights }
  );

  const worker = new Worker(ADS_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: CONCURRENCY,
  });

  worker.on('completed', (job, result) => {
    console.log(`[ads-worker] ${job.name} ${job.id} completed`);
  });
  worker.on('failed', (job, error) => {
    console.error(`[ads-worker] ${job?.name} ${job?.id} failed: ${error.message}`);
  });
  worker.on('error', (error) => {
    console.error('[ads-worker] error', error);
  });

  return {
    async close() {
      await worker.close();
      await closeAdsQueue();
    },
  };
}
