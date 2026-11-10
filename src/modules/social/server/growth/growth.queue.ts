import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const GROWTH_QUEUE_NAME = 'social-growth-queue';

export const GROWTH_JOB = {
  /** Every connected Shopify store (scheduler). */
  syncAllStores: 'growth.shopify.syncAll',
  /** One store right after connecting / "Sync now". data: { storeId } */
  syncStore: 'growth.shopify.syncStore',
  /** Post stage → tasks for every client with posts (scheduler). */
  contentTasks: 'growth.content.tasks',
  /** Daily AI insights + tasks for every client with a store or ad account (scheduler). */
  dailyInsights: 'growth.insights.daily',
  /** Every GA4 property assigned to a client (scheduler). */
  syncAllGa4: 'growth.ga4.syncAll',
  /** One GA4 property right after assigning it. data: { propertyRowId } */
  syncGa4Property: 'growth.ga4.syncProperty',
} as const;

let queue: Queue | undefined;

export function getGrowthQueue() {
  if (!queue) {
    queue = new Queue(GROWTH_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
  }
  return queue;
}

export async function enqueueStoreSync(storeId: string) {
  await getGrowthQueue().add(GROWTH_JOB.syncStore, { storeId }, { jobId: `shopify-sync-${storeId}-${Date.now()}` });
}

export async function enqueueGa4Sync(propertyRowId: string) {
  await getGrowthQueue().add(GROWTH_JOB.syncGa4Property, { propertyRowId }, { jobId: `ga4-sync-${propertyRowId}-${Date.now()}` });
}

export async function closeGrowthQueue() {
  await queue?.close();
  queue = undefined;
}
