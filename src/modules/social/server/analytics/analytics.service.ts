import 'server-only';
import { HttpError } from '@/shared/server/http-error';
import { ANALYTICS_MAX_RANGE_DAYS } from '../../config/analytics';
import type { AnalyticsChannel, AnalyticsSummary } from '../../types/analytics';
import { integrationRegistry } from '../integrations/core/integration.registry';
import { analyticsRepository } from './analytics.repository';
import type { AnalyticsQuery } from './analytics.schema';

const DAY_MS = 24 * 60 * 60 * 1000;

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

    const [outcomes, scheduled, drafts, channelRows] = await Promise.all([
      analyticsRepository.listOutcomes(organizationId, start, end),
      analyticsRepository.countUpcoming(organizationId, new Date()),
      analyticsRepository.countDrafts(organizationId),
      analyticsRepository.listChannels(organizationId),
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
    };
  },
};
