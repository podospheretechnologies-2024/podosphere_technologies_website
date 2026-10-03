import 'server-only';
import { HttpError } from '@/shared/server/http-error';
import { ANALYTICS_MAX_RANGE_DAYS } from '../../config/analytics';
import type {
  AnalyticsChannel,
  AnalyticsPost,
  AnalyticsPostMetrics,
  AnalyticsSummary,
} from '../../types/analytics';
import type { PostMedia } from '../../types/post';
import { integrationRegistry } from '../integrations/core/integration.registry';
import { analyticsRepository } from './analytics.repository';
import type { AnalyticsQuery } from './analytics.schema';
import { fetchMetaHistoryForChannel, type MetaHistoryPost } from './meta-history';
import { fetchPostMetrics } from './post-metrics';

const DAY_MS = 24 * 60 * 60 * 1000;
const METRICS_CONCURRENCY = 8;
const CHANNEL_SYNC_CONCURRENCY = 3;
const MAX_POSTS_WITH_METRICS = 150;

const emptyMetrics = (): AnalyticsPostMetrics => ({
  likes: null,
  views: null,
  comments: null,
  shares: null,
  reach: null,
  impressions: null,
  engagement: null,
  saved: null,
  clicks: null,
});

function addMetric(current: number | null, next: number | null): number | null {
  if (next === null) return current;
  return (current ?? 0) + next;
}

function mergeMetrics(
  primary: AnalyticsPostMetrics,
  seed: AnalyticsPostMetrics
): AnalyticsPostMetrics {
  return {
    likes: primary.likes ?? seed.likes,
    views: primary.views ?? seed.views,
    comments: primary.comments ?? seed.comments,
    shares: primary.shares ?? seed.shares,
    reach: primary.reach ?? seed.reach,
    impressions: primary.impressions ?? seed.impressions,
    engagement: primary.engagement ?? seed.engagement,
    saved: primary.saved ?? seed.saved,
    clicks: primary.clicks ?? seed.clicks,
  };
}

async function mapPool<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  if (items.length === 0) return [] as R[];
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function thumbnailFromMedia(media: unknown): string | null {
  if (!Array.isArray(media) || media.length === 0) return null;
  const first = media[0] as PostMedia;
  return typeof first?.url === 'string' ? first.url : null;
}

function providerNameOf(identifier: string) {
  return integrationRegistry.get(identifier)?.name ?? identifier;
}

export const analyticsService = {
  async summary(organizationId: string, query: AnalyticsQuery): Promise<AnalyticsSummary> {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    if (end <= start) {
      throw new HttpError(400, 'End date must be after start date');
    }
    if (end.getTime() - start.getTime() > ANALYTICS_MAX_RANGE_DAYS * DAY_MS) {
      throw new HttpError(400, `Range cannot exceed ${ANALYTICS_MAX_RANGE_DAYS} days`);
    }

    const [outcomes, scheduled, drafts, channelRows, publishedRows] = await Promise.all([
      analyticsRepository.listOutcomes(organizationId, start, end),
      analyticsRepository.countUpcoming(organizationId, new Date()),
      analyticsRepository.countDrafts(organizationId),
      analyticsRepository.listChannels(organizationId),
      analyticsRepository.listPublishedPosts(organizationId, start, end),
    ]);

    const channels = new Map<string, AnalyticsChannel>(
      channelRows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          picture: row.picture,
          providerIdentifier: row.providerIdentifier,
          providerName: providerNameOf(row.providerIdentifier),
          published: 0,
          failed: 0,
          metrics: emptyMetrics(),
        },
      ])
    );

    let failed = 0;
    for (const outcome of outcomes) {
      if (outcome.state === 'ERROR') {
        failed += 1;
        const channel = channels.get(outcome.integrationId);
        if (channel) channel.failed += 1;
      }
    }

    // App-published posts (may overlap with Meta history via releaseId).
    const appPostsByRelease = new Map<string, (typeof publishedRows)[number]>();
    for (const row of publishedRows) {
      if (row.releaseId) appPostsByRelease.set(row.releaseId, row);
    }

    // Sync historical posts from Meta for every FB / IG channel (includes pre-website posts).
    const metaChannels = channelRows.filter(
      (row) => row.providerIdentifier === 'facebook' || row.providerIdentifier === 'instagram'
    );
    const metaByChannel = await mapPool(metaChannels, CHANNEL_SYNC_CONCURRENCY, async (row) => {
      const history = await fetchMetaHistoryForChannel(
        {
          providerIdentifier: row.providerIdentifier,
          internalId: row.internalId,
          accessToken: row.accessToken,
        },
        start,
        end
      );
      return { channelId: row.id, history };
    });

    const metaPosts: { channelId: string; post: MetaHistoryPost }[] = [];
    for (const entry of metaByChannel) {
      for (const post of entry.history) {
        metaPosts.push({ channelId: entry.channelId, post });
      }
    }

    // Merge: Meta history + any app-only published posts without a Meta match.
    type MergedSource = {
      id: string;
      releaseId: string | null;
      content: string;
      publishDate: Date;
      releaseUrl: string | null;
      thumbnailUrl: string | null;
      channelId: string;
      providerIdentifier: string;
      accessToken: string;
      seedMetrics: AnalyticsPostMetrics;
    };

    const merged = new Map<string, MergedSource>();

    for (const { channelId, post } of metaPosts) {
      const channel = channelRows.find((row) => row.id === channelId);
      if (!channel) continue;
      const app = appPostsByRelease.get(post.releaseId);
      merged.set(post.releaseId, {
        id: app?.id ?? `meta:${post.releaseId}`,
        releaseId: post.releaseId,
        content: post.content || app?.content || '',
        publishDate: post.publishDate,
        releaseUrl: post.releaseUrl ?? app?.releaseUrl ?? null,
        thumbnailUrl: post.thumbnailUrl ?? thumbnailFromMedia(app?.media) ?? null,
        channelId,
        providerIdentifier: channel.providerIdentifier,
        accessToken: channel.accessToken,
        seedMetrics: post.seedMetrics,
      });
    }

    for (const row of publishedRows) {
      if (row.releaseId && merged.has(row.releaseId)) continue;
      const key = row.releaseId ?? `app:${row.id}`;
      if (merged.has(key)) continue;
      merged.set(key, {
        id: row.id,
        releaseId: row.releaseId,
        content: row.content,
        publishDate: row.publishDate,
        releaseUrl: row.releaseUrl,
        thumbnailUrl: thumbnailFromMedia(row.media),
        channelId: row.integration.id,
        providerIdentifier: row.integration.providerIdentifier,
        accessToken: row.integration.accessToken,
        seedMetrics: emptyMetrics(),
      });
    }

    const mergedList = [...merged.values()].sort(
      (a, b) => b.publishDate.getTime() - a.publishDate.getTime()
    );

    const posts: AnalyticsPost[] = await mapPool(
      mergedList.slice(0, MAX_POSTS_WITH_METRICS),
      METRICS_CONCURRENCY,
      async (row) => {
        const { metrics, unavailable } = await fetchPostMetrics(
          row.providerIdentifier,
          row.releaseId,
          row.accessToken
        );
        const mergedMetrics = mergeMetrics(metrics, row.seedMetrics);
        const hasAny = Object.values(mergedMetrics).some((value) => value !== null);
        const channelRow = channelRows.find((entry) => entry.id === row.channelId);
        return {
          id: row.id,
          content: row.content,
          publishDate: row.publishDate.toISOString(),
          releaseUrl: row.releaseUrl,
          thumbnailUrl: row.thumbnailUrl,
          channel: {
            id: row.channelId,
            name: channelRow?.name ?? 'Channel',
            picture: channelRow?.picture ?? null,
            providerIdentifier: row.providerIdentifier,
            providerName: providerNameOf(row.providerIdentifier),
          },
          metrics: mergedMetrics,
          metricsUnavailable: unavailable && !hasAny,
        };
      }
    );

    // Reset published counts from synced Meta + app posts in range.
    for (const channel of channels.values()) {
      channel.published = 0;
      channel.metrics = emptyMetrics();
    }
    for (const post of posts) {
      const channel = channels.get(post.channel.id);
      if (!channel) continue;
      channel.published += 1;
      channel.metrics = {
        likes: addMetric(channel.metrics.likes, post.metrics.likes),
        views: addMetric(channel.metrics.views, post.metrics.views),
        comments: addMetric(channel.metrics.comments, post.metrics.comments),
        shares: addMetric(channel.metrics.shares, post.metrics.shares),
        reach: addMetric(channel.metrics.reach, post.metrics.reach),
        impressions: addMetric(channel.metrics.impressions, post.metrics.impressions),
        engagement: addMetric(channel.metrics.engagement, post.metrics.engagement),
        saved: addMetric(channel.metrics.saved, post.metrics.saved),
        clicks: addMetric(channel.metrics.clicks, post.metrics.clicks),
      };
    }

    // Include Meta posts beyond the metrics cap in published counts (without extra Graph calls).
    if (mergedList.length > MAX_POSTS_WITH_METRICS) {
      const counted = new Set(posts.map((post) => post.id));
      for (const row of mergedList.slice(MAX_POSTS_WITH_METRICS)) {
        if (counted.has(row.id)) continue;
        const channel = channels.get(row.channelId);
        if (channel) channel.published += 1;
      }
    }

    const published = [...channels.values()].reduce((sum, channel) => sum + channel.published, 0);
    const attempted = published + failed;

    const activity = [
      ...outcomes
        .filter((outcome) => outcome.state === 'ERROR')
        .map((outcome) => ({
          date: outcome.publishDate.toISOString(),
          outcome: 'error' as const,
          channelId: outcome.integrationId,
        })),
      ...mergedList.map((row) => ({
        date: row.publishDate.toISOString(),
        outcome: 'published' as const,
        channelId: row.channelId,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return {
      totals: { published, failed, scheduled, drafts },
      successRate: attempted > 0 ? Math.round((published / attempted) * 100) : null,
      channels: [...channels.values()].sort(
        (a, b) => b.published + b.failed - (a.published + a.failed)
      ),
      activity,
      posts,
    };
  },
};
