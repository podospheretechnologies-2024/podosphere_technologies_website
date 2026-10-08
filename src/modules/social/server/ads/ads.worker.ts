import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getAdsQueue, closeAdsQueue, ADS_JOB, ADS_QUEUE_NAME } from './ads.queue';
import { prisma } from '@/shared/lib/prisma';
import { graphGet, type GraphConfig, type GraphList } from '../integrations/providers/meta/graph-client';
import { getServerEnv } from '@/shared/lib/env';

// 2 hours for structure (campaigns/adsets/ads)
const SYNC_STRUCTURE_EVERY_MS = 2 * 60 * 60 * 1000;
// 1 hour for today's insights
const SYNC_INSIGHTS_EVERY_MS = 1 * 60 * 60 * 1000;
const CONCURRENCY = 2;

function getGraphConfig(): GraphConfig {
  return {
    version: getServerEnv().META_GRAPH_VERSION,
    appSecret: getServerEnv().META_APP_SECRET,
  };
}

async function syncStructure() {
  console.log('[ads-worker] Syncing ad structure (campaigns, ad sets, ads)...');
  const accounts = await prisma.adAccount.findMany({ where: { status: 1 } });
  const config = getGraphConfig();
  const token = getServerEnv().META_SYSTEM_USER_TOKEN;

  for (const account of accounts) {
    try {
      const res = await graphGet<GraphList<any>>(
        config,
        `${account.externalId}/campaigns`,
        token,
        { fields: 'id,name,effective_status,objective,daily_budget' }
      );
      
      for (const camp of res.data || []) {
        await prisma.adEntity.upsert({
          where: { adAccountId_externalId: { adAccountId: account.id, externalId: camp.id } },
          update: { name: camp.name, status: camp.effective_status, objective: camp.objective, dailyBudget: camp.daily_budget },
          create: {
            adAccountId: account.id,
            level: 'campaign',
            externalId: camp.id,
            name: camp.name,
            status: camp.effective_status,
            objective: camp.objective,
            dailyBudget: camp.daily_budget
          }
        });
      }
    } catch (e) {
      console.error(`[ads-worker] Failed to sync campaigns for ${account.externalId}`, e);
    }
  }
}

async function syncInsights() {
  console.log('[ads-worker] Syncing ad insights...');
  const accounts = await prisma.adAccount.findMany({ where: { status: 1 } });
  const config = getGraphConfig();
  const token = getServerEnv().META_SYSTEM_USER_TOKEN;

  for (const account of accounts) {
    try {
      const res = await graphGet<GraphList<any>>(
        config,
        `${account.externalId}/insights`,
        token,
        { 
          level: 'campaign', 
          date_preset: 'today', 
          fields: 'campaign_id,spend,impressions,reach,clicks,cpc,ctr,actions' 
        }
      );
      
      const today = new Date();
      today.setHours(0,0,0,0);

      for (const insight of res.data || []) {
        let leads = 0;
        if (insight.actions) {
          const leadAction = insight.actions.find((a: any) => a.action_type === 'lead');
          leads = leadAction ? parseInt(leadAction.value) : 0;
        }

        await prisma.adInsightDaily.upsert({
          where: { level_entityId_date: { level: 'campaign', entityId: insight.campaign_id, date: today } },
          update: {
            spend: insight.spend,
            impressions: insight.impressions,
            reach: insight.reach,
            clicks: parseInt(insight.clicks || '0'),
            leads: leads,
            cpc: insight.cpc || null,
            ctr: insight.ctr || null,
          },
          create: {
            adAccountId: account.id,
            level: 'campaign',
            entityId: insight.campaign_id,
            date: today,
            spend: insight.spend || '0',
            impressions: insight.impressions || 0,
            reach: insight.reach || 0,
            clicks: parseInt(insight.clicks || '0'),
            leads: leads,
            cpc: insight.cpc || null,
            ctr: insight.ctr || null,
          }
        });
      }
    } catch (e) {
      console.error(`[ads-worker] Failed to sync insights for ${account.externalId}`, e);
    }
  }
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
