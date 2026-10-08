import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getAnalyticsQueue, closeAnalyticsQueue, ANALYTICS_JOB, ANALYTICS_QUEUE_NAME } from './analytics.queue';
import { prisma } from '@/shared/lib/prisma';
import { graphGet, type GraphConfig, type GraphList } from '../integrations/providers/meta/graph-client';
import { getServerEnv } from '@/shared/lib/env';
import { decrypt } from '@/shared/lib/crypto';

const SYNC_POSTS_EVERY_MS = 2 * 60 * 60 * 1000;
const SYNC_POST_METRICS_EVERY_MS = 6 * 60 * 60 * 1000;
const CAPTURE_STORIES_EVERY_MS = 4 * 60 * 60 * 1000;
const SYNC_DAILY_INSIGHTS_EVERY_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 3;

function getGraphConfig(): GraphConfig {
  return {
    version: getServerEnv().META_GRAPH_VERSION,
    appSecret: getServerEnv().META_APP_SECRET,
  };
}

async function syncPosts() {
  console.log('[analytics-worker] Syncing posts (external posts + basic counts)...');
  const integrations = await prisma.socialIntegration.findMany({ 
    where: { provider: 'meta', deletedAt: null } 
  });
  const config = getGraphConfig();

  for (const integration of integrations) {
    if (!integration.igId) continue;
    try {
      const token = decrypt(integration.accessToken);
      const res = await graphGet<GraphList<any>>(
        config,
        `${integration.igId}/media`,
        token,
        { fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count', limit: 20 }
      );

      for (const media of res.data || []) {
        await prisma.socialExternalPost.upsert({
          where: { integrationId_externalId: { integrationId: integration.id, externalId: media.id } },
          update: {
            likes: media.like_count || 0,
            comments: media.comments_count || 0,
            caption: media.caption || null,
          },
          create: {
            integrationId: integration.id,
            externalId: media.id,
            type: (media.media_type || 'post').toLowerCase(),
            caption: media.caption || null,
            permalink: media.permalink || null,
            thumbnailUrl: media.media_url || null,
            publishedAt: new Date(media.timestamp),
            likes: media.like_count || 0,
            comments: media.comments_count || 0,
          }
        });
      }
    } catch (e) {
      console.error(`[analytics-worker] Failed syncing posts for integration ${integration.id}`, e);
    }
  }
}

async function syncPostMetrics() {
  console.log('[analytics-worker] Syncing post metrics (reach, impressions, saves)...');
}

async function captureStories() {
  console.log('[analytics-worker] Capturing live stories...');
}

async function syncDailyInsights() {
  console.log('[analytics-worker] Syncing daily insights (followers, profile views)...');
  const integrations = await prisma.socialIntegration.findMany({ 
    where: { provider: 'meta', deletedAt: null } 
  });
  const config = getGraphConfig();

  for (const integration of integrations) {
    if (!integration.igId) continue;
    try {
      const token = decrypt(integration.accessToken);
      const res = await graphGet<any>(
        config,
        `${integration.igId}`,
        token,
        { fields: 'followers_count' }
      );

      if (res.followers_count !== undefined) {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        await prisma.socialInsightDaily.upsert({
          where: { integrationId_date_metric: { integrationId: integration.id, date: today, metric: 'followers' } },
          update: { value: res.followers_count },
          create: {
            integrationId: integration.id,
            date: today,
            metric: 'followers',
            value: res.followers_count
          }
        });
      }
    } catch (e) {
      console.error(`[analytics-worker] Failed syncing daily insights for integration ${integration.id}`, e);
    }
  }
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
