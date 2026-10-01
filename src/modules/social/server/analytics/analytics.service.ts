import 'server-only';
import { HttpError } from '@/shared/server/http-error';
import { ANALYTICS_MAX_RANGE_DAYS } from '../../config/analytics';
import type { AnalyticsChannel, AnalyticsPost, AnalyticsSummary } from '../../types/analytics';
import type { PostMedia } from '../../types/post';
import { integrationRegistry } from '../integrations/core/integration.registry';
import { analyticsRepository } from './analytics.repository';
import type { AnalyticsQuery } from './analytics.schema';
import { fetchPostMetrics } from './post-metrics';

const DAY_MS = 24 * 60 * 60 * 1000;
const METRICS_CONCURRENCY = 6;

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
          providerName:
            integrationRegistry.get(row.providerIdentifier)?.name ?? row.providerIdentifier,
          published: 0,
          failed: 0,
        },
      ])
    );

    let published = 0;
    let failed = 0;
    for (const outcome of outcomes) {
      const channel = channels.get(outcome.integrationId);
      if (outcome.state === 'PUBLISHED') {
        published += 1;
        if (channel) channel.published += 1;
      } else {
        failed += 1;
        if (channel) channel.failed += 1;
      }
    }

    const posts: AnalyticsPost[] = await mapPool(
      publishedRows,
      METRICS_CONCURRENCY,
      async (row) => {
        const providerName =
          integrationRegistry.get(row.integration.providerIdentifier)?.name ??
          row.integration.providerIdentifier;
        const { metrics, unavailable } = await fetchPostMetrics(
          row.integration.providerIdentifier,
          row.releaseId,
          row.integration.accessToken
        );
        return {
          id: row.id,
          content: row.content,
          publishDate: row.publishDate.toISOString(),
          releaseUrl: row.releaseUrl,
          thumbnailUrl: thumbnailFromMedia(row.media),
          channel: {
            id: row.integration.id,
            name: row.integration.name,
            picture: row.integration.picture,
            providerIdentifier: row.integration.providerIdentifier,
            providerName,
          },
          metrics,
          metricsUnavailable: unavailable,
        };
      }
    );

    const attempted = published + failed;

    return {
      totals: { published, failed, scheduled, drafts },
      successRate: attempted > 0 ? Math.round((published / attempted) * 100) : null,
      channels: [...channels.values()].sort(
        (a, b) => b.published + b.failed - (a.published + a.failed)
      ),
      activity: outcomes.map((outcome) => ({
        date: outcome.publishDate.toISOString(),
        outcome: outcome.state === 'PUBLISHED' ? 'published' : 'error',
      })),
      posts,
    };
  },
};
