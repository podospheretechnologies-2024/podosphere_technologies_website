import 'server-only';
import { last30Days, resolveTimeZone } from '@/shared/lib/metric-window';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, socialCustomerIdWhere, type ClientScope } from '@/shared/server/client-scope';
import type { AgencyOverview } from '../../types/overview';

export type { AgencyOverview };

const DAY_MS = 24 * 60 * 60 * 1000;

export const overviewService = {
  async summarize(scope: ClientScope): Promise<AgencyOverview> {
    // R3: under "All clients" the totals are the clients' totals; Unassigned rows are reported
    // separately (admin-only line) and never mixed in.
    const allClients = scope.customerIds === 'all';
    const where = allClients
      ? { organizationId: scope.organizationId, customerId: { not: null } }
      : scopeWhere(scope);
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
    const org = await prisma.organization.findUnique({
      where: { id: scope.organizationId },
      select: { timeZone: true },
    });
    const window = last30Days(resolveTimeZone(org?.timeZone), now);

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
      prisma.socialLead.count({
        where: { ...where, createdAt: { gte: window.fromAt, lt: window.until } },
      }),
      prisma.socialCustomer.count({
        where: {
          organizationId: scope.organizationId,
          deletedAt: null,
          ...socialCustomerIdWhere(scope),
        },
      }),
      prisma.socialIntegration.findMany({
        where: { ...where, deletedAt: null },
        select: { id: true },
      }),
      prisma.adAccount.findMany({
        where: { ...where, isAgencyAccount: false },
        select: { id: true },
      }),
    ]);

    const integrationIds = integrations.map((row) => row.id);
    const adAccountIds = adAccounts.map((row) => row.id);

    const [inboxWaiting, syncErrors, spendAgg, followerRows] = await Promise.all([
      countInboxWaiting(where),
      countSyncErrors(scope.organizationId, integrationIds, adAccountIds),
      adAccountIds.length
        ? prisma.adInsightDaily.aggregate({
            where: {
              adAccountId: { in: adAccountIds },
              level: 'campaign',
              date: { gte: window.from, lte: window.to },
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
    const unassigned = allClients ? await summarizeUnassigned(scope.organizationId) : null;

    return {
      postsDue,
      drafts,
      leads,
      inboxWaiting,
      syncErrors,
      spend30d: spend != null ? Number(spend) : adAccountIds.length ? 0 : null,
      followers: integrationIds.length ? followersTotal : null,
      clients,
      unassigned,
    };
  },
};

async function countInboxWaiting(where: Prisma.SocialInboxThreadWhereInput): Promise<number> {
  return prisma.socialInboxThread.count({
    where: {
      ...where,
      lastDirection: 'inbound',
      closedAt: null,
      hiddenAt: null,
    },
  });
}

/** Admin-only "N Pages not mapped" line (R3). */
async function summarizeUnassigned(
  organizationId: string
): Promise<AgencyOverview['unassigned']> {
  const channels = await prisma.socialIntegration.findMany({
    where: { organizationId, customerId: null, deletedAt: null },
    select: { id: true },
  });
  if (channels.length === 0) return { channels: 0, followers: null };
  const followerRows = await prisma.socialInsightDaily.findMany({
    where: { integrationId: { in: channels.map((row) => row.id) }, metric: 'followers' },
    orderBy: { date: 'desc' },
    distinct: ['integrationId'],
    select: { value: true },
  });
  return {
    channels: channels.length,
    followers: followerRows.length
      ? followerRows.reduce((sum, row) => sum + Number(row.value), 0)
      : null,
  };
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
