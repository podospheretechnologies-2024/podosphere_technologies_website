import { prisma } from '@/shared/lib/prisma';
import { getClientScope, scopeWhere } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';
import {
  parseCompetitorMedia,
  topPostsThisMonth,
} from '@/modules/social/server/analytics/competitor-media';
import { isClaudeConfigured } from '@/modules/social/server/ai/claude.client';

export async function GET() {
  try {
    const scope = await getClientScope('view');

    const integrations = await prisma.socialIntegration.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      select: { id: true, name: true, providerIdentifier: true },
    });

    const integrationIds = integrations.map((item) => item.id);
    const dailyInsights = integrationIds.length
      ? await prisma.socialInsightDaily.findMany({
          where: { integrationId: { in: integrationIds }, metric: 'followers' },
          orderBy: { date: 'asc' },
        })
      : [];

    const latestFollowers: Record<string, number> = {};
    for (const row of dailyInsights) {
      latestFollowers[row.integrationId] = Number(row.value);
    }

    const competitors = await prisma.socialCompetitor.findMany({
      where: { organizationId: scope.organizationId },
      include: { snapshots: { orderBy: { date: 'asc' } } },
    });

    return Response.json({
      integrations: integrations.map((channel) => ({
        ...channel,
        followers: latestFollowers[channel.id] ?? 0,
      })),
      totalAudienceSize: Object.values(latestFollowers).reduce((sum, value) => sum + value, 0),
      dailyInsights: dailyInsights.map((row) => ({
        integrationId: row.integrationId,
        date: row.date,
        value: Number(row.value),
      })),
      aiSummaryAvailable: isClaudeConfigured(),
      competitors: competitors.map((comp) => {
        const latest = comp.snapshots[comp.snapshots.length - 1];
        const recentMedia = parseCompetitorMedia(latest?.recentMedia);
        return {
          ...comp,
          snapshots: comp.snapshots.map(({ recentMedia: _media, ...snap }) => snap),
          topPosts: topPostsThisMonth(recentMedia, 5),
        };
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
