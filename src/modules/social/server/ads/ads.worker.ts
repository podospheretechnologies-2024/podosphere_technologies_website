import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getAdsQueue, closeAdsQueue, ADS_JOB, ADS_QUEUE_NAME } from './ads.queue';
import { prisma } from '@/shared/lib/prisma';
import { decrypt } from '@/shared/lib/crypto';
import {
  GraphApiError,
  graphGetAll,
  type GraphConfig,
} from '../integrations/providers/meta/graph-client';
import { softParseGraphList } from '../integrations/providers/meta/graph-soft-parse';
import {
  adCampaignNodeSchema,
  adInsightRowSchema,
  adNodeSchema,
  adSetNodeSchema,
} from './ads.graph.schema';
import { getServerEnv } from '@/shared/lib/env';

// 2 hours for structure (campaigns/adsets/ads)
const SYNC_STRUCTURE_EVERY_MS = 2 * 60 * 60 * 1000;
// 1 hour for today's insights
const SYNC_INSIGHTS_EVERY_MS = 1 * 60 * 60 * 1000;
const CONCURRENCY = 2;
const STRUCTURE_PAGE_LIMIT = 100;

type AdAccountRow = {
  id: string;
  externalId: string;
  accessTokenEncrypted: string | null;
  refreshNeeded: boolean;
  timezoneName?: string;
};

/**
 * Calendar date in the ad account's IANA timezone, stored as UTC midnight
 * (DATE column = account-local day, not server-local midnight).
 */
function accountDateOnly(ianaTimezone: string | null | undefined, now = new Date()): Date {
  const tz = ianaTimezone && ianaTimezone.trim() ? ianaTimezone.trim() : 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    if (!year || !month || !day) throw new Error('incomplete date parts');
    return new Date(Date.UTC(year, month - 1, day));
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}

/** Rethrow rate limits so BullMQ exponential backoff retries the job. */
function rethrowIfRetryable(error: unknown): void {
  if (error instanceof GraphApiError && error.isRateLimitError) throw error;
}

function getGraphConfig(): GraphConfig {
  return {
    version: getServerEnv().META_GRAPH_VERSION,
    appSecret: getServerEnv().META_APP_SECRET,
  };
}

/**
 * Per-account Meta token only. Never falls back to META_SYSTEM_USER_TOKEN
 * (multi-tenant safety — refuse when missing).
 */
async function resolveAccountToken(account: AdAccountRow): Promise<string | null> {
  if (!account.accessTokenEncrypted) {
    console.warn(
      `[ads-worker] Skipping ${account.externalId}: no accessTokenEncrypted (set via sync or PUT /api/social/ads/accounts/{id}/token)`
    );
    if (!account.refreshNeeded) {
      await markRefreshNeeded(account.id);
    }
    return null;
  }

  try {
    return decrypt(account.accessTokenEncrypted);
  } catch {
    console.error(`[ads-worker] Skipping ${account.externalId}: stored token decrypt failed`);
    await markRefreshNeeded(account.id);
    return null;
  }
}

async function markRefreshNeeded(accountId: string): Promise<void> {
  const result = await prisma.adAccount.updateMany({
    where: { id: accountId, refreshNeeded: false },
    data: { refreshNeeded: true },
  });
  if (result.count === 0) return;

  const account = await prisma.adAccount.findUnique({
    where: { id: accountId },
    select: { organizationId: true, name: true, externalId: true },
  });
  if (!account) return;

  const { notificationService } = await import('../notifications/notification.service');
  void notificationService
    .tokenExpired(
      account.organizationId,
      account.name || account.externalId,
      '/dashboard/social/ads'
    )
    .catch((err) => console.error('[ads-worker] token_expired notify failed', err));
}

async function upsertEntity(input: {
  adAccountId: string;
  level: 'campaign' | 'adset' | 'ad';
  externalId: string;
  parentId?: string | null;
  name: string;
  status: string;
  objective?: string | null;
  dailyBudget?: string | number | null;
}) {
  await prisma.adEntity.upsert({
    where: {
      adAccountId_externalId: { adAccountId: input.adAccountId, externalId: input.externalId },
    },
    update: {
      level: input.level,
      parentId: input.parentId ?? null,
      name: input.name,
      status: input.status,
      objective: input.objective ?? null,
      dailyBudget: input.dailyBudget ?? null,
    },
    create: {
      adAccountId: input.adAccountId,
      level: input.level,
      externalId: input.externalId,
      parentId: input.parentId ?? null,
      name: input.name,
      status: input.status,
      objective: input.objective ?? null,
      dailyBudget: input.dailyBudget ?? null,
    },
  });
}

async function syncStructure() {
  console.log('[ads-worker] Syncing ad structure (campaigns, ad sets, ads)...');
  const accounts = await prisma.adAccount.findMany({
    where: { status: 1 },
    select: {
      id: true,
      externalId: true,
      accessTokenEncrypted: true,
      refreshNeeded: true,
    },
  });
  const config = getGraphConfig();

  for (const account of accounts) {
    const token = await resolveAccountToken(account);
    if (!token) continue;

    try {
      const campaigns = softParseGraphList(
        adCampaignNodeSchema,
        await graphGetAll(config, `${account.externalId}/campaigns`, token, {
          fields: 'id,name,effective_status,objective,daily_budget',
          limit: STRUCTURE_PAGE_LIMIT,
        }),
        `ads.campaigns:${account.externalId}`
      );

      for (const camp of campaigns) {
        await upsertEntity({
          adAccountId: account.id,
          level: 'campaign',
          externalId: camp.id,
          name: camp.name ?? camp.id,
          status: camp.effective_status ?? 'UNKNOWN',
          objective: camp.objective ?? null,
          dailyBudget: camp.daily_budget ?? null,
        });
      }

      const adSets = softParseGraphList(
        adSetNodeSchema,
        await graphGetAll(config, `${account.externalId}/adsets`, token, {
          fields: 'id,name,effective_status,campaign_id',
          limit: STRUCTURE_PAGE_LIMIT,
        }),
        `ads.adsets:${account.externalId}`
      );

      for (const adset of adSets) {
        await upsertEntity({
          adAccountId: account.id,
          level: 'adset',
          externalId: adset.id,
          parentId: adset.campaign_id ?? null,
          name: adset.name ?? adset.id,
          status: adset.effective_status ?? 'UNKNOWN',
        });
      }

      const ads = softParseGraphList(
        adNodeSchema,
        await graphGetAll(config, `${account.externalId}/ads`, token, {
          fields: 'id,name,effective_status,adset_id,campaign_id',
          limit: STRUCTURE_PAGE_LIMIT,
        }),
        `ads.ads:${account.externalId}`
      );

      for (const ad of ads) {
        await upsertEntity({
          adAccountId: account.id,
          level: 'ad',
          externalId: ad.id,
          parentId: ad.adset_id ?? ad.campaign_id ?? null,
          name: ad.name ?? ad.id,
          status: ad.effective_status ?? 'UNKNOWN',
        });
      }

      if (account.refreshNeeded) {
        await prisma.adAccount.update({
          where: { id: account.id },
          data: { refreshNeeded: false },
        });
      }
    } catch (error) {
      rethrowIfRetryable(error);
      if (error instanceof GraphApiError && error.isAuthError) {
        console.warn(
          `[ads-worker] Token invalid for ${account.externalId}; marked refreshNeeded`
        );
        await markRefreshNeeded(account.id);
        continue;
      }
      console.error(`[ads-worker] Failed to sync structure for ${account.externalId}`, error);
    }
  }
}

async function syncInsights() {
  console.log('[ads-worker] Syncing ad insights...');
  const accounts = await prisma.adAccount.findMany({
    where: { status: 1 },
    select: {
      id: true,
      externalId: true,
      accessTokenEncrypted: true,
      refreshNeeded: true,
      timezoneName: true,
    },
  });
  const config = getGraphConfig();

  for (const account of accounts) {
    const token = await resolveAccountToken(account);
    if (!token) continue;

    try {
      const insights = softParseGraphList(
        adInsightRowSchema,
        await graphGetAll(config, `${account.externalId}/insights`, token, {
          level: 'campaign',
          date_preset: 'today',
          fields: 'campaign_id,spend,impressions,reach,clicks,cpc,ctr,actions',
          limit: STRUCTURE_PAGE_LIMIT,
        }),
        `ads.insights:${account.externalId}`
      );

      const today = accountDateOnly(account.timezoneName);

      for (const insight of insights) {
        if (!insight.campaign_id) continue;

        let leads = 0;
        if (insight.actions) {
          const leadAction = insight.actions.find((a) => a.action_type === 'lead');
          leads = leadAction ? parseInt(leadAction.value, 10) || 0 : 0;
        }

        const impressions = BigInt(parseInt(insight.impressions || '0', 10) || 0);
        const reach = BigInt(parseInt(insight.reach || '0', 10) || 0);

        await prisma.adInsightDaily.upsert({
          where: {
            level_entityId_date: {
              level: 'campaign',
              entityId: insight.campaign_id,
              date: today,
            },
          },
          update: {
            spend: insight.spend,
            impressions,
            reach,
            clicks: parseInt(insight.clicks || '0', 10) || 0,
            leads,
            cpc: insight.cpc || null,
            ctr: insight.ctr || null,
          },
          create: {
            adAccountId: account.id,
            level: 'campaign',
            entityId: insight.campaign_id,
            date: today,
            spend: insight.spend || '0',
            impressions,
            reach,
            clicks: parseInt(insight.clicks || '0', 10) || 0,
            leads,
            cpc: insight.cpc || null,
            ctr: insight.ctr || null,
          },
        });
      }

      if (account.refreshNeeded) {
        await prisma.adAccount.update({
          where: { id: account.id },
          data: { refreshNeeded: false },
        });
      }
    } catch (error) {
      rethrowIfRetryable(error);
      if (error instanceof GraphApiError && error.isAuthError) {
        console.warn(
          `[ads-worker] Token invalid for ${account.externalId}; marked refreshNeeded`
        );
        await markRefreshNeeded(account.id);
        continue;
      }
      console.error(`[ads-worker] Failed to sync insights for ${account.externalId}`, error);
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

  worker.on('completed', (job) => {
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
