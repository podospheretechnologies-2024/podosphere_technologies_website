import { prisma } from '@/shared/lib/prisma';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');

    const integrations = await prisma.socialIntegration.findMany({
      where: { organizationId: organization.id, deletedAt: null },
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
      where: { organizationId: organization.id },
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
      competitors,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
