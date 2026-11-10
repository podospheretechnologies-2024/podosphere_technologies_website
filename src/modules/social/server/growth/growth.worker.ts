import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { prisma } from '@/shared/lib/prisma';
import { closeGrowthQueue, getGrowthQueue, GROWTH_JOB, GROWTH_QUEUE_NAME } from './growth.queue';
import { shopifyService } from './shopify.service';
import { contentService } from './records.service';
import { generateInsights } from './growth-ai.service';
import { workerScope } from './growth-scope';
import { localDay } from './growth-metrics';

const SYNC_STORES_EVERY_MS = 3 * 60 * 60 * 1000;
const CONTENT_TASKS_EVERY_MS = 60 * 60 * 1000;
const INSIGHTS_CHECK_EVERY_MS = 60 * 60 * 1000;
/** Insights run once per client per day, after this hour in India (data from the night sync is in). */
const INSIGHTS_AFTER_HOUR_IST = 8;

async function syncAllStores() {
  const stores = await prisma.socialShopifyStore.findMany({ select: { id: true } });
  for (const store of stores) await shopifyService.syncStore(store.id);
}

async function contentTasks() {
  const clients = await prisma.socialPost.groupBy({
    by: ['organizationId', 'customerId'],
    where: { deletedAt: null, customerId: { not: null }, publishDate: { gte: new Date(Date.now() - 7 * 86400000) } },
  });
  for (const row of clients) {
    if (!row.customerId) continue;
    try {
      await contentService.syncTasks(row.organizationId, row.customerId);
    } catch (error) {
      console.error(`[growth-worker] content tasks failed for ${row.customerId}`, error);
    }
  }
}

function istHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(now));
}

async function dailyInsights() {
  if (istHour() < INSIGHTS_AFTER_HOUR_IST) return;
  const today = localDay(new Date(), 'Asia/Kolkata');
  const [stores, accounts] = await Promise.all([
    prisma.socialShopifyStore.findMany({ select: { organizationId: true, customerId: true } }),
    prisma.adAccount.findMany({ where: { customerId: { not: null }, status: 1 }, select: { organizationId: true, customerId: true } }),
  ]);
  const clients = new Map<string, string>();
  for (const s of stores) clients.set(s.customerId, s.organizationId);
  for (const a of accounts) if (a.customerId) clients.set(a.customerId, a.organizationId);

  for (const [customerId, organizationId] of clients) {
    const [customer, settings] = await Promise.all([
      prisma.socialCustomer.findFirst({ where: { id: customerId, organizationId, deletedAt: null }, select: { name: true } }),
      prisma.socialGrowthSettings.findUnique({ where: { customerId }, select: { insightsEnabled: true, lastInsightsAt: true } }),
    ]);
    if (!customer || settings?.insightsEnabled === false) continue;
    if (settings?.lastInsightsAt && localDay(settings.lastInsightsAt, 'Asia/Kolkata') === today) continue;
    try {
      await generateInsights({ scope: workerScope(organizationId, customerId), organizationId, customerId, customerName: customer.name });
    } catch (error) {
      // Budget reached / AI off: skip quietly until tomorrow.
      console.warn(`[growth-worker] insights skipped for ${customer.name}: ${error instanceof Error ? error.message : error}`);
      await prisma.socialGrowthSettings.upsert({
        where: { customerId },
        update: { lastInsightsAt: new Date() },
        create: { organizationId, customerId, lastInsightsAt: new Date() },
      });
    }
  }
}

function processJob(job: Job) {
  switch (job.name) {
    case GROWTH_JOB.syncAllStores:
      return syncAllStores();
    case GROWTH_JOB.syncStore:
      return shopifyService.syncStore(String((job.data as { storeId?: string }).storeId ?? ''));
    case GROWTH_JOB.contentTasks:
      return contentTasks();
    case GROWTH_JOB.dailyInsights:
      return dailyInsights();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startGrowthWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getGrowthQueue();
  await queue.upsertJobScheduler(GROWTH_JOB.syncAllStores, { every: SYNC_STORES_EVERY_MS }, { name: GROWTH_JOB.syncAllStores });
  await queue.upsertJobScheduler(GROWTH_JOB.contentTasks, { every: CONTENT_TASKS_EVERY_MS }, { name: GROWTH_JOB.contentTasks });
  await queue.upsertJobScheduler(GROWTH_JOB.dailyInsights, { every: INSIGHTS_CHECK_EVERY_MS }, { name: GROWTH_JOB.dailyInsights });

  const worker = new Worker(GROWTH_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: 2,
  });
  worker.on('completed', (job) => console.log(`[growth-worker] ${job.name} ${job.id} completed`));
  worker.on('failed', (job, error) => console.error(`[growth-worker] ${job?.name} ${job?.id} failed: ${error.message}`));
  worker.on('error', (error) => console.error('[growth-worker] error', error));

  return {
    async close() {
      await worker.close();
      await closeGrowthQueue();
    },
  };
}
