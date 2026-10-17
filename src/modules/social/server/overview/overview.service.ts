import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import type { AgencyOverview } from '../../types/overview';

export type { AgencyOverview };

const DAY_MS = 24 * 60 * 60 * 1000;

export const overviewService = {
  async summarize(scope: ClientScope): Promise<AgencyOverview> {
    const where = scopeWhere(scope);
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

    const [postsDue, drafts, leads, clients, integrations, adAccounts] = await Promise.all([
      prisma.socialPost.count({
        where: {
          ...where,
          deletedAt: null,
          state: 'QUEUE',
          publishDate: { gte: now, lte: weekAhead },
        },
      }),
      prisma.socialPost.count({
        where: { ...where, deletedAt: null, state: 'DRAFT' },
      }),
      prisma.socialLead.count({ where }),
      prisma.socialCustomer.count({
        where: {
          organizationId: scope.organizationId,
          ...(scope.customerIds === 'all' ? {} : { id: { in: scope.customerIds } }),
        },
      }),
      prisma.socialIntegration.findMany({
        where: { ...where, deletedAt: null },
        select: { id: true },
      }),
      prisma.adAccount.findMany({
        where,
        select: { id: true },
      }),
    ]);

    const integrationIds = integrations.map((row) => row.id);
    const adAccountIds = adAccounts.map((row) => row.id);

    const [inboxWaiting, syncErrors, spendAgg, followerRows] = await Promise.all([
      countInboxWaiting(scope),
      countSyncErrors(scope.organizationId, integrationIds, adAccountIds),
      adAccountIds.length
        ? prisma.adInsightDaily.aggregate({
            where: {
              adAccountId: { in: adAccountIds },
              level: 'campaign',
              date: { gte: thirtyDaysAgo },
            },
            _sum: { spend: true },
          })
        : Promise.resolve({ _sum: { spend: null } }),
      integrationIds.length
        ? prisma.socialInsightDaily.findMany({
            where: { integrationId: { in: integrationIds }, metric: 'followers' },
            orderBy: { date: 'desc' },
            distinct: ['integrationId'],
            select: { integrationId: true, value: true },
          })
        : Promise.resolve([]),
    ]);

    const spend = spendAgg._sum.spend;
    const followersTotal = followerRows.reduce((sum, row) => sum + Number(row.value), 0);

    return {
      postsDue,
      drafts,
      leads,
      inboxWaiting,
      syncErrors,
      spend30d: spend != null ? Number(spend) : adAccountIds.length ? 0 : null,
      followers: integrationIds.length ? followersTotal : null,
      clients,
    };
  },
};

async function countInboxWaiting(scope: ClientScope): Promise<number> {
  const threads = await prisma.socialInboxThread.findMany({
    where: scopeWhere(scope),
    select: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { direction: true },
      },
    },
    take: 500,
  });
  return threads.filter((thread) => thread.messages[0]?.direction === 'inbound').length;
}

async function countSyncErrors(
  organizationId: string,
  integrationIds: string[],
  adAccountIds: string[]
): Promise<number> {
  if (integrationIds.length === 0 && adAccountIds.length === 0) {
    return 0;
  }

  return prisma.socialSyncState.count({
    where: {
      organizationId,
      OR: [{ lastError: { not: null } }, { failures: { gt: 0 } }],
      AND: [
        {
          OR: [
            ...(integrationIds.length ? [{ integrationId: { in: integrationIds } }] : []),
            ...(adAccountIds.length ? [{ adAccountId: { in: adAccountIds } }] : []),
          ],
        },
      ],
    },
  });
}
