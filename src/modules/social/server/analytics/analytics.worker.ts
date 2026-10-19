import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getAnalyticsQueue, closeAnalyticsQueue, ANALYTICS_JOB, ANALYTICS_QUEUE_NAME } from './analytics.queue';
import { prisma } from '@/shared/lib/prisma';
import {
  GraphApiError,
  graphCollectAll,
  graphGet,
  graphGetAll,
  type GraphConfig,
  type GraphList,
} from '../integrations/providers/meta/graph-client';
import { softParseGraph, softParseGraphList } from '../integrations/providers/meta/graph-soft-parse';
import { getServerEnv } from '@/shared/lib/env';
import { decrypt } from '@/shared/lib/crypto';
import { integrationRepository } from '../integrations/integration.repository';
import {
  competitorDiscoveryMediaSchema,
  competitorDiscoveryResponseSchema,
  type CompetitorDiscoveryMedia,
} from './analytics.graph.schema';
import {
  averageEngagementRate,
  competitorMediaToJson,
  type CompetitorMediaItem,
} from './competitor-media';

import { fetchPostMetrics } from './post-metrics';

/** Rethrow rate limits so BullMQ exponential backoff retries the job. */
function rethrowIfRetryable(error: unknown): void {
  if (error instanceof GraphApiError && error.isRateLimitError) throw error;
}

const SYNC_POSTS_EVERY_MS = 2 * 60 * 60 * 1000;
const SYNC_POST_METRICS_EVERY_MS = 6 * 60 * 60 * 1000;
const CAPTURE_STORIES_EVERY_MS = 4 * 60 * 60 * 1000;
const SYNC_DAILY_INSIGHTS_EVERY_MS = 24 * 60 * 60 * 1000;
const BACKFILL_DAYS = 90;
const BACKFILL_KIND = 'backfill';
const BACKFILL_PAGE_LIMIT = 50;
/** ~90 days of media for busy accounts (50 × 40). */
const BACKFILL_MAX_PAGES = 40;
/** Nested business_discovery.media pages (~25 items each). */
const COMPETITOR_MEDIA_MAX_PAGES = 2;
const COMPETITOR_MEDIA_PAGE_LIMIT = 25;
const CONCURRENCY = 3;

const COMPETITOR_MEDIA_FIELDS =
  'id,caption,like_count,comments_count,media_type,permalink,timestamp,media_url,thumbnail_url';

interface InsightRow {
  name: string;
  values?: { value: number | Record<string, number> }[];
}

interface IgMediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface FbPagePost {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  comments?: { summary?: { total_count?: number } };
  reactions?: { summary?: { total_count?: number } };
}

type BackfillJobData = { integrationId?: string };

function getGraphConfig(): GraphConfig {
  return {
    version: getServerEnv().META_GRAPH_VERSION,
    appSecret: getServerEnv().META_APP_SECRET,
  };
}

const META_PROVIDERS = ['facebook', 'instagram'] as const;

function utcDateOnly(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function insightValue(
  rows: InsightRow[] | undefined,
  name: string
): number | null {
  const row = rows?.find((entry) => entry.name === name);
  const value = row?.values?.[0]?.value;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, entry) => sum + (Number(entry) || 0), 0);
  }
  return null;
}

function firstInsight(rows: InsightRow[] | undefined, names: string[]): number | null {
  for (const name of names) {
    const value = insightValue(rows, name);
    if (value !== null) return value;
  }
  return null;
}

async function fetchStoryInsights(
  config: GraphConfig,
  storyId: string,
  token: string
): Promise<{ reach: number | null; impressions: number | null; replies: number | null }> {
  // Newer APIs prefer views/reach/replies; older stories still expose impressions.
  const metricSets = ['reach,views,replies', 'impressions,reach,replies', 'reach,replies'];
  let reach: number | null = null;
  let impressions: number | null = null;
  let replies: number | null = null;

  for (const metric of metricSets) {
    try {
      const insights = await graphGet<GraphList<InsightRow>>(config, `${storyId}/insights`, token, {
        metric,
      });
      reach = reach ?? insightValue(insights.data, 'reach');
      impressions =
        impressions ?? firstInsight(insights.data, ['views', 'impressions']);
      replies = replies ?? insightValue(insights.data, 'replies');
      if (reach !== null || impressions !== null || replies !== null) break;
    } catch (error) {
      if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) {
        throw error;
      }
      // Try the next metric set (permissions / deprecations / "not enough viewers").
    }
  }

  return { reach, impressions, replies };
}

async function markBackfillRun(
  integration: { id: string; organizationId: string },
  patch: {
    lastError?: string | null;
    failures?: number;
    backfillDoneAt?: Date | null;
    cursor?: string | null;
  }
): Promise<void> {
  const now = new Date();
  await prisma.socialSyncState.upsert({
    where: {
      integrationId_kind: { integrationId: integration.id, kind: BACKFILL_KIND },
    },
    update: {
      lastRunAt: now,
      ...(patch.lastError === undefined
        ? {}
        : { lastError: patch.lastError }),
      ...(patch.failures === undefined ? {} : { failures: patch.failures }),
      ...(patch.backfillDoneAt === undefined
        ? {}
        : { backfillDoneAt: patch.backfillDoneAt }),
      ...(patch.cursor === undefined ? {} : { cursor: patch.cursor }),
      ...(patch.backfillDoneAt ? { lastSuccessAt: now } : {}),
    },
    create: {
      organizationId: integration.organizationId,
      integrationId: integration.id,
      kind: BACKFILL_KIND,
      lastRunAt: now,
      lastSuccessAt: patch.backfillDoneAt ?? null,
      lastError: patch.lastError ?? null,
      failures: patch.failures ?? 0,
      backfillDoneAt: patch.backfillDoneAt ?? null,
      cursor: patch.cursor ?? null,
    },
  });
}

async function syncPosts() {
  console.log('[analytics-worker] Syncing posts (external posts + basic counts)...');
  const integrations = await prisma.socialIntegration.findMany({
    where: { providerIdentifier: { in: [...META_PROVIDERS] }, deletedAt: null },
  });
  const config = getGraphConfig();

  for (const integration of integrations) {
    if (!integration.internalId) continue;
    try {
      const token = decrypt(integration.accessToken);
      if (integration.providerIdentifier === 'instagram') {
        const mediaItems = await graphGetAll<{
          id: string;
          caption?: string;
          media_type?: string;
          media_url?: string;
          permalink?: string;
          timestamp: string;
          like_count?: number;
          comments_count?: number;
        }>(config, `${integration.internalId}/media`, token, {
          fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
          limit: 50,
        });
        for (const media of mediaItems) {
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
            },
          });
        }
        continue;
      }

      const posts = await graphGetAll<{
        id: string;
        message?: string;
        created_time: string;
        permalink_url?: string;
        full_picture?: string;
        comments?: { summary?: { total_count?: number } };
        reactions?: { summary?: { total_count?: number } };
      }>(config, `${integration.internalId}/published_posts`, token, {
        fields: 'id,message,created_time,permalink_url,full_picture,comments.summary(true),reactions.summary(true)',
        limit: 50,
      });
      for (const post of posts) {
        await prisma.socialExternalPost.upsert({
          where: { integrationId_externalId: { integrationId: integration.id, externalId: post.id } },
          update: {
            likes: post.reactions?.summary?.total_count || 0,
            comments: post.comments?.summary?.total_count || 0,
            caption: post.message || null,
          },
          create: {
            integrationId: integration.id,
            externalId: post.id,
            type: 'post',
            caption: post.message || null,
            permalink: post.permalink_url || null,
            thumbnailUrl: post.full_picture || null,
            publishedAt: new Date(post.created_time),
            likes: post.reactions?.summary?.total_count || 0,
            comments: post.comments?.summary?.total_count || 0,
          },
        });
      }
    } catch (e) {
      if (e instanceof GraphApiError && e.isAuthError) {
        await integrationRepository.markRefreshNeeded(integration.id);
        console.warn(`[analytics-worker] Token invalid for integration ${integration.id}; marked refreshNeeded`);
        continue;
      }
      rethrowIfRetryable(e);
      console.error(`[analytics-worker] Failed syncing posts for integration ${integration.id}`, e);
    }
  }
}

async function syncPostMetrics() {
  console.log('[analytics-worker] Syncing post metrics (reach, impressions, saves)...');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Find external posts from the last 30 days
  const recentPosts = await prisma.socialExternalPost.findMany({
    where: {
      publishedAt: { gte: thirtyDaysAgo },
    },
  });

  const integrationIds = Array.from(new Set(recentPosts.map(p => p.integrationId)));
  const integrations = await prisma.socialIntegration.findMany({
    where: { id: { in: integrationIds }, deletedAt: null },
    select: { id: true, providerIdentifier: true, accessToken: true },
  });
  const integrationMap = new Map<string, any>(integrations.map((i: any) => [i.id, i]));

  for (const post of recentPosts) {
    const integration = integrationMap.get(post.integrationId);
    if (!integration) continue;

    try {
      const { metrics, unavailable } = await fetchPostMetrics(
        integration.providerIdentifier,
        post.externalId,
        integration.accessToken
      );

      if (!unavailable) {
        await prisma.socialExternalPost.update({
          where: { id: post.id },
          data: {
            likes: metrics.likes ?? post.likes,
            comments: metrics.comments ?? post.comments,
            shares: metrics.shares ?? post.shares,
            saves: metrics.saved ?? post.saves,
            reach: metrics.reach ?? post.reach,
            impressions: metrics.impressions ?? post.impressions,
            videoViews: metrics.views ?? post.videoViews,
            metricsAt: new Date(),
          },
        });
      }
    } catch (e) {
      if (e instanceof GraphApiError && e.isAuthError) {
        await integrationRepository.markRefreshNeeded(integration.id);
        console.warn(`[analytics-worker] Token invalid for integration ${integration.id}; marked refreshNeeded`);
        continue;
      }
      rethrowIfRetryable(e);
      console.error(`[analytics-worker] Failed syncing metrics for post ${post.id}`, e);
    }
  }
}

async function captureStories() {
  console.log('[analytics-worker] Capturing live stories...');
  const integrations = await prisma.socialIntegration.findMany({
    where: { providerIdentifier: 'instagram', deletedAt: null, disabled: false },
  });
  const config = getGraphConfig();

  for (const integration of integrations) {
    if (!integration.internalId) continue;
    try {
      const token = decrypt(integration.accessToken);
      // Live stories only — Meta drops them ~24h; capture on the 4h cadence.
      const stories = await graphGetAll<IgMediaItem>(
        config,
        `${integration.internalId}/stories`,
        token,
        {
          fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
          limit: 50,
        },
        { maxPages: 5 }
      );

      for (const story of stories) {
        let reach: number | null = null;
        let impressions: number | null = null;
        let replies: number | null = null;
        try {
          const insights = await fetchStoryInsights(config, story.id, token);
          reach = insights.reach;
          impressions = insights.impressions;
          replies = insights.replies;
        } catch (error) {
          if (error instanceof GraphApiError && error.isAuthError) throw error;
          rethrowIfRetryable(error);
          console.warn(
            `[analytics-worker] Story insights unavailable for ${story.id}`,
            error instanceof Error ? error.message : error
          );
        }

        const publishedAt = new Date(story.timestamp);
        if (Number.isNaN(publishedAt.getTime())) continue;

        await prisma.socialExternalPost.upsert({
          where: {
            integrationId_externalId: {
              integrationId: integration.id,
              externalId: story.id,
            },
          },
          update: {
            caption: story.caption || null,
            permalink: story.permalink || null,
            thumbnailUrl: story.thumbnail_url || story.media_url || null,
            comments: replies,
            reach,
            impressions,
            metricsAt: new Date(),
          },
          create: {
            integrationId: integration.id,
            externalId: story.id,
            type: 'story',
            caption: story.caption || null,
            permalink: story.permalink || null,
            thumbnailUrl: story.thumbnail_url || story.media_url || null,
            publishedAt,
            comments: replies,
            reach,
            impressions,
            metricsAt: new Date(),
          },
        });
      }
    } catch (e) {
      if (e instanceof GraphApiError && e.isAuthError) {
        await integrationRepository.markRefreshNeeded(integration.id);
        console.warn(
          `[analytics-worker] Token invalid for integration ${integration.id}; marked refreshNeeded`
        );
        continue;
      }
      rethrowIfRetryable(e);
      console.error(
        `[analytics-worker] Failed capturing stories for integration ${integration.id}`,
        e
      );
    }
  }
}

async function applyPostMetrics(
  providerIdentifier: string,
  externalId: string,
  encryptedAccessToken: string,
  postId: string,
  seed: { likes?: number | null; comments?: number | null }
): Promise<void> {
  const { metrics, unavailable } = await fetchPostMetrics(
    providerIdentifier,
    externalId,
    encryptedAccessToken
  );
  if (unavailable) return;
  await prisma.socialExternalPost.update({
    where: { id: postId },
    data: {
      likes: metrics.likes ?? seed.likes ?? null,
      comments: metrics.comments ?? seed.comments ?? null,
      shares: metrics.shares,
      saves: metrics.saved,
      reach: metrics.reach,
      impressions: metrics.impressions,
      videoViews: metrics.views,
      metricsAt: new Date(),
    },
  });
}

async function backfillInstagram(
  config: GraphConfig,
  integration: { id: string; internalId: string; accessToken: string },
  token: string,
  since: Date
): Promise<number> {
  // /media has no reliable since filter — page newest-first via graphGetAll, keep ≥ since.
  const mediaItems = await graphGetAll<IgMediaItem>(
    config,
    `${integration.internalId}/media`,
    token,
    {
      fields:
        'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: BACKFILL_PAGE_LIMIT,
    },
    { maxPages: BACKFILL_MAX_PAGES }
  );

  let upserted = 0;
  for (const media of mediaItems) {
    const publishedAt = new Date(media.timestamp);
    if (Number.isNaN(publishedAt.getTime())) continue;
    // Newest-first: once we pass the window, the rest are older.
    if (publishedAt < since) break;

    const row = await prisma.socialExternalPost.upsert({
      where: {
        integrationId_externalId: {
          integrationId: integration.id,
          externalId: media.id,
        },
      },
      update: {
        likes: media.like_count || 0,
        comments: media.comments_count || 0,
        caption: media.caption || null,
        permalink: media.permalink || null,
        thumbnailUrl: media.thumbnail_url || media.media_url || null,
      },
      create: {
        integrationId: integration.id,
        externalId: media.id,
        type: (media.media_type || 'post').toLowerCase(),
        caption: media.caption || null,
        permalink: media.permalink || null,
        thumbnailUrl: media.thumbnail_url || media.media_url || null,
        publishedAt,
        likes: media.like_count || 0,
        comments: media.comments_count || 0,
      },
    });
    upserted += 1;

    try {
      await applyPostMetrics(
        'instagram',
        media.id,
        integration.accessToken,
        row.id,
        { likes: media.like_count, comments: media.comments_count }
      );
    } catch (error) {
      if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) {
        throw error;
      }
    }
  }

  return upserted;
}

async function backfillFacebook(
  config: GraphConfig,
  integration: { id: string; internalId: string; accessToken: string },
  token: string,
  since: Date
): Promise<number> {
  const sinceUnix = Math.floor(since.getTime() / 1000);
  let posts: FbPagePost[];
  try {
    posts = await graphGetAll<FbPagePost>(
      config,
      `${integration.internalId}/published_posts`,
      token,
      {
        fields:
          'id,message,created_time,permalink_url,full_picture,comments.summary(true),reactions.summary(true)',
        limit: BACKFILL_PAGE_LIMIT,
        since: sinceUnix,
      },
      { maxPages: BACKFILL_MAX_PAGES }
    );
  } catch (error) {
    if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) {
      throw error;
    }
    // Some pages restrict published_posts — fall back to /posts.
    posts = await graphGetAll<FbPagePost>(
      config,
      `${integration.internalId}/posts`,
      token,
      {
        fields:
          'id,message,created_time,permalink_url,full_picture,comments.summary(true),reactions.summary(true)',
        limit: BACKFILL_PAGE_LIMIT,
        since: sinceUnix,
      },
      { maxPages: BACKFILL_MAX_PAGES }
    );
  }

  let upserted = 0;
  for (const post of posts) {
    const publishedAt = new Date(post.created_time);
    if (Number.isNaN(publishedAt.getTime()) || publishedAt < since) continue;

    const likes = post.reactions?.summary?.total_count || 0;
    const comments = post.comments?.summary?.total_count || 0;
    const row = await prisma.socialExternalPost.upsert({
      where: {
        integrationId_externalId: {
          integrationId: integration.id,
          externalId: post.id,
        },
      },
      update: {
        likes,
        comments,
        caption: post.message || null,
        permalink: post.permalink_url || null,
        thumbnailUrl: post.full_picture || null,
      },
      create: {
        integrationId: integration.id,
        externalId: post.id,
        type: 'post',
        caption: post.message || null,
        permalink: post.permalink_url || null,
        thumbnailUrl: post.full_picture || null,
        publishedAt,
        likes,
        comments,
      },
    });
    upserted += 1;

    try {
      await applyPostMetrics('facebook', post.id, integration.accessToken, row.id, {
        likes,
        comments,
      });
    } catch (error) {
      if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) {
        throw error;
      }
    }
  }

  return upserted;
}

async function backfillIntegration(integrationId: string): Promise<void> {
  const integration = await prisma.socialIntegration.findFirst({
    where: {
      id: integrationId,
      providerIdentifier: { in: [...META_PROVIDERS] },
      deletedAt: null,
    },
  });
  if (!integration?.internalId) return;

  const existing = await prisma.socialSyncState.findUnique({
    where: {
      integrationId_kind: { integrationId: integration.id, kind: BACKFILL_KIND },
    },
  });
  if (existing?.backfillDoneAt) {
    console.log(`[analytics-worker] Backfill already done for ${integration.id}`);
    return;
  }

  const since = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
  const config = getGraphConfig();

  try {
    await markBackfillRun(integration, { lastError: null, failures: 0 });
    const token = decrypt(integration.accessToken);
    const count =
      integration.providerIdentifier === 'instagram'
        ? await backfillInstagram(config, integration, token, since)
        : await backfillFacebook(config, integration, token, since);

    await markBackfillRun(integration, {
      lastError: null,
      failures: 0,
      backfillDoneAt: new Date(),
      cursor: since.toISOString(),
    });
    console.log(
      `[analytics-worker] Backfill complete for ${integration.id}: ${count} posts (~${BACKFILL_DAYS}d)`
    );
  } catch (e) {
    if (e instanceof GraphApiError && e.isAuthError) {
      await integrationRepository.markRefreshNeeded(integration.id);
      await markBackfillRun(integration, {
        lastError: e.message,
        failures: (existing?.failures ?? 0) + 1,
      });
      console.warn(
        `[analytics-worker] Token invalid during backfill for ${integration.id}; marked refreshNeeded`
      );
      return;
    }
    rethrowIfRetryable(e);
    await markBackfillRun(integration, {
      lastError: e instanceof Error ? e.message : String(e),
      failures: (existing?.failures ?? 0) + 1,
    });
    console.error(`[analytics-worker] Backfill failed for ${integration.id}`, e);
  }
}

/** First-connect / missing syncState flag: pull ~90 days of media + insights. */
async function runBackfill(data: BackfillJobData = {}): Promise<void> {
  console.log('[analytics-worker] Running channel backfill...');

  if (data.integrationId) {
    await backfillIntegration(data.integrationId);
    return;
  }

  const integrations = await prisma.socialIntegration.findMany({
    where: {
      providerIdentifier: { in: [...META_PROVIDERS] },
      deletedAt: null,
      disabled: false,
    },
    select: { id: true },
  });

  for (const integration of integrations) {
    const state = await prisma.socialSyncState.findUnique({
      where: {
        integrationId_kind: { integrationId: integration.id, kind: BACKFILL_KIND },
      },
    });
    if (state?.backfillDoneAt) continue;
    await backfillIntegration(integration.id);
  }
}

/** Canonical SocialInsightDaily.metric keys written by syncDailyInsights. */
const DAILY_INSIGHT_METRICS = [
  'followers',
  'reach',
  'impressions',
  'profile_views',
  'website_clicks',
] as const;

type DailyInsightMetric = (typeof DAILY_INSIGHT_METRICS)[number];

async function upsertDailyMetric(
  integrationId: string,
  date: Date,
  metric: DailyInsightMetric,
  value: number | null | undefined
): Promise<void> {
  if (value === null || value === undefined || !Number.isFinite(value)) return;
  await prisma.socialInsightDaily.upsert({
    where: { integrationId_date_metric: { integrationId, date, metric } },
    update: { value },
    create: { integrationId, date, metric, value },
  });
}

/**
 * Try metric sets until one succeeds. Soft-fail when Meta omits / rejects a set
 * (deprecated metrics, missing permissions). Auth + rate-limit still propagate.
 */
async function fetchAccountInsightRows(
  config: GraphConfig,
  objectId: string,
  token: string,
  metricSets: string[],
  label: string
): Promise<InsightRow[]> {
  for (const metric of metricSets) {
    try {
      const res = await graphGet<GraphList<InsightRow>>(config, `${objectId}/insights`, token, {
        metric,
        period: 'day',
      });
      return res.data ?? [];
    } catch (error) {
      rethrowIfRetryable(error);
      if (error instanceof GraphApiError && error.isAuthError) throw error;
      console.warn(
        `[analytics-worker] ${label} insights metric set "${metric}" unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  return [];
}

function mapAccountInsights(
  provider: string,
  rows: InsightRow[]
): Partial<Record<Exclude<DailyInsightMetric, 'followers'>, number | null>> {
  if (provider === 'instagram') {
    return {
      reach: insightValue(rows, 'reach'),
      // `views` replaces deprecated `impressions` on newer Graph versions.
      impressions: firstInsight(rows, ['impressions', 'views']),
      profile_views: insightValue(rows, 'profile_views'),
      // Soft-map profile link taps when website_clicks is omitted (v22+).
      website_clicks: firstInsight(rows, ['website_clicks', 'profile_links_taps']),
    };
  }
  return {
    reach: firstInsight(rows, ['page_impressions_unique', 'reach']),
    impressions: firstInsight(rows, ['page_impressions', 'impressions', 'views']),
    profile_views: firstInsight(rows, ['page_views_total', 'page_views', 'profile_views']),
    website_clicks: firstInsight(rows, [
      'page_website_clicks',
      'page_website_clicks_logged_in_unique',
      'website_clicks',
    ]),
  };
}

async function syncDailyInsights() {
  console.log(
    '[analytics-worker] Syncing daily insights (followers, reach, impressions, profile views, website clicks)...'
  );
  const integrations = await prisma.socialIntegration.findMany({
    where: { providerIdentifier: { in: [...META_PROVIDERS] }, deletedAt: null },
  });
  const config = getGraphConfig();

  for (const integration of integrations) {
    if (!integration.internalId) continue;
    try {
      const token = decrypt(integration.accessToken);
      const today = utcDateOnly();
      const objectId = integration.internalId;
      const provider = integration.providerIdentifier;

      try {
        const fields = provider === 'instagram' ? 'followers_count' : 'followers_count,fan_count';
        const res = await graphGet<{ followers_count?: number; fan_count?: number }>(
          config,
          objectId,
          token,
          { fields }
        );
        await upsertDailyMetric(
          integration.id,
          today,
          'followers',
          res.followers_count ?? res.fan_count
        );
      } catch (error) {
        rethrowIfRetryable(error);
        if (error instanceof GraphApiError && error.isAuthError) throw error;
        console.warn(
          `[analytics-worker] Followers unavailable for integration ${integration.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      const metricSets =
        provider === 'instagram'
          ? [
              'reach,impressions,profile_views,website_clicks',
              'reach,views,profile_views,website_clicks',
              'reach,views,profile_links_taps',
              'reach,views',
              'reach',
            ]
          : [
              'page_impressions_unique,page_impressions,page_views_total,page_website_clicks',
              'page_impressions_unique,page_impressions,page_views_total,page_website_clicks_logged_in_unique',
              'page_impressions_unique,page_impressions,page_views_total',
              'page_impressions_unique,page_impressions',
            ];

      const rows = await fetchAccountInsightRows(
        config,
        objectId,
        token,
        metricSets,
        `${provider}:${objectId}`
      );
      const mapped = mapAccountInsights(provider, rows);
      await upsertDailyMetric(integration.id, today, 'reach', mapped.reach);
      await upsertDailyMetric(integration.id, today, 'impressions', mapped.impressions);
      await upsertDailyMetric(integration.id, today, 'profile_views', mapped.profile_views);
      await upsertDailyMetric(integration.id, today, 'website_clicks', mapped.website_clicks);
    } catch (e) {
      if (e instanceof GraphApiError && e.isAuthError) {
        await integrationRepository.markRefreshNeeded(integration.id);
        console.warn(`[analytics-worker] Token invalid for integration ${integration.id}; marked refreshNeeded`);
        continue;
      }
      rethrowIfRetryable(e);
      console.error(`[analytics-worker] Failed syncing daily insights for integration ${integration.id}`, e);
    }
  }
}

function mapDiscoveryMedia(rows: CompetitorDiscoveryMedia[]): CompetitorMediaItem[] {
  return rows.map((row) => ({
    id: row.id,
    caption: row.caption ?? null,
    likeCount: row.like_count,
    commentsCount: row.comments_count,
    mediaType: (row.media_type || 'IMAGE').toUpperCase(),
    permalink: row.permalink ?? null,
    timestamp: row.timestamp ?? '',
    thumbnailUrl: row.thumbnail_url ?? row.media_url ?? null,
  }));
}

async function syncCompetitors() {
  console.log('[analytics-worker] Syncing competitor stats + recent media...');
  const competitors = await prisma.socialCompetitor.findMany();

  if (competitors.length === 0) return;

  const config = getGraphConfig();

  for (const comp of competitors) {
    try {
      // Find ANY connected integration for this org/customer to use its token
      const integration = await prisma.socialIntegration.findFirst({
        where: {
          organizationId: comp.organizationId,
          ...(comp.customerId ? { customerId: comp.customerId } : {}),
          providerIdentifier: 'instagram',
          deletedAt: null,
        },
      });

      if (!integration?.internalId) {
        console.warn(`[analytics-worker] No valid Meta integration found to track competitor ${comp.name}`);
        continue;
      }

      const token = decrypt(integration.accessToken);
      const username = comp.externalId.replace(/[^a-zA-Z0-9._]/g, '');
      if (!username) {
        console.warn(`[analytics-worker] Skipping competitor ${comp.name}: empty username`);
        continue;
      }

      // Nested media cannot use graphGetAll path-style; first page comes from field expansion,
      // then graphCollectAll follows paging.next (same helper as graphGetAll).
      const mediaEdge = `media.limit(${COMPETITOR_MEDIA_PAGE_LIMIT}){${COMPETITOR_MEDIA_FIELDS}}`;
      const raw = await graphGet<unknown>(config, `${integration.internalId}`, token, {
        fields: `business_discovery.username(${username}){followers_count,media_count,${mediaEdge}}`,
      });

      const res = softParseGraph(
        competitorDiscoveryResponseSchema,
        raw,
        `competitors.discovery:${username}`,
        { business_discovery: undefined }
      );

      const discovery = res.business_discovery;
      if (!discovery) continue;

      const firstMediaPage: GraphList<unknown> = {
        data: discovery.media?.data ?? [],
        paging: discovery.media?.paging,
      };
      const rawMedia = await graphCollectAll(config, token, firstMediaPage, {
        maxPages: COMPETITOR_MEDIA_MAX_PAGES,
      });
      const parsedMedia = softParseGraphList(
        competitorDiscoveryMediaSchema,
        rawMedia,
        `competitors.media:${username}`
      );
      const recentMedia = mapDiscoveryMedia(parsedMedia);
      const followers = discovery.followers_count;

      await prisma.competitorSnapshot.create({
        data: {
          competitorId: comp.id,
          followers,
          postsCount: discovery.media_count,
          engagementRate: averageEngagementRate(recentMedia, followers),
          recentMedia: competitorMediaToJson(recentMedia),
        },
      });
    } catch (e) {
      rethrowIfRetryable(e);
      console.error(`[analytics-worker] Failed syncing competitor ${comp.name}`, e);
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
      return syncDailyInsights().then(syncCompetitors);
    case ANALYTICS_JOB.backfill:
      return runBackfill((job.data ?? {}) as BackfillJobData);
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

  // Catch Meta channels connected before backfill existed (or mid-flight failures).
  void queue
    .add(
      ANALYTICS_JOB.backfill,
      {} satisfies BackfillJobData,
      // BullMQ rejects custom ids that contain `:`.
      { jobId: 'meta.backfill-scan', removeOnComplete: true, removeOnFail: true }
    )
    .catch((error) => {
      // Duplicate jobId while a prior scan is still queued/active is expected on restart.
      console.warn('[analytics-worker] Could not enqueue backfill scan', error);
    });

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
