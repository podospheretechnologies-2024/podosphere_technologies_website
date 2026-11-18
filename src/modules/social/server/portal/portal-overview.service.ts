import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { PORTAL_BASE_PATH, isPortalAdSpendVisible, parsePortalTabsConfig } from '../../config/portal-tabs';
import type { PortalSession } from '../approvals/approval.service';
import { parsePortalGoals, type PortalGoalsConfig } from './portal-goals.schema';

const DAY_MS = 24 * 60 * 60 * 1000;

export type PortalOverviewTileId =
  | 'postsDue'
  | 'waitingApproval'
  | 'leads'
  | 'inboxWaiting'
  | 'spend30d'
  | 'followers';

export type PortalOverviewStat = {
  id: PortalOverviewTileId;
  label: string;
  value: string;
  href: string;
};

export type PortalOverviewRecentPost = {
  id: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  likes: number;
  comments: number;
  reach: number | null;
  channelName: string;
  channelPicture: string | null;
};

export type PortalMonthHighlight = {
  id: string;
  label: string;
  value: string;
};

export type PortalGoalProgress = {
  id: 'leads' | 'posts' | 'budget';
  label: string;
  current: number;
  target: number;
  unit: 'count' | 'money';
  currency?: string;
};

export type PortalOverviewDto = {
  hasChannels: boolean;
  stats: PortalOverviewStat[];
  recentPosts: PortalOverviewRecentPost[];
  /** "What we did this month" feed. */
  thisMonth: PortalMonthHighlight[];
  goals: PortalGoalProgress[];
  goalsConfig: PortalGoalsConfig;
};

function monthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatCount(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

async function countInboxWaiting(
  session: Pick<PortalSession, 'organizationId' | 'customerId'>
): Promise<number> {
  const threads = await prisma.socialInboxThread.findMany({
    where: {
      organizationId: session.organizationId,
      customerId: session.customerId,
    },
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

export const portalOverviewService = {
  async get(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalOverviewDto> {
    const { organizationId, customerId } = session;
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
    const since30 = daysAgo(30);
    const startOfMonth = monthStart();

    const [integrations, customer, metaAccounts, googleCount, shopify] = await Promise.all([
      prisma.socialIntegration.findMany({
        where: { organizationId, customerId, deletedAt: null },
        select: { id: true, name: true, picture: true },
      }),
      prisma.socialCustomer.findFirst({
        where: { id: customerId, organizationId, deletedAt: null },
        select: { portalTabs: true, portalGoals: true },
      }),
      prisma.adAccount.findMany({
        where: { organizationId, customerId },
        select: { id: true, currency: true },
      }),
      prisma.socialGoogleAdsAccount.count({
        where: { organizationId, customerId },
      }),
      prisma.socialShopifyStore.findFirst({
        where: { organizationId, customerId },
        select: { id: true, currency: true },
      }),
    ]);

    const goalsConfig = parsePortalGoals(customer?.portalGoals);
    const showSpend = isPortalAdSpendVisible({
      hasChannels: integrations.length > 0,
      hasAds: metaAccounts.length > 0 || googleCount > 0,
      hasShopify: Boolean(shopify),
      hasLeadSources: true,
      hasWhatsApp: false,
      portalTabs: parsePortalTabsConfig(customer?.portalTabs),
    });

    const integrationIds = integrations.map((row) => row.id);
    const channelById = new Map(integrations.map((row) => [row.id, row]));
    const metaIds = metaAccounts.map((row) => row.id);
    const currency = metaAccounts[0]?.currency ?? shopify?.currency ?? 'INR';
    const money = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    const nf = new Intl.NumberFormat('en-IN');

    const [
      postsDue,
      waitingApproval,
      leadsTotal,
      inboxWaiting,
      followerRows,
      spend30Agg,
      spendMonthAgg,
      posts,
      postsThisMonth,
      leadsMonth,
      campaignsLive,
      requestsMonth,
      salesMonth,
    ] = await Promise.all([
      prisma.socialPost.count({
        where: {
          organizationId,
          customerId,
          deletedAt: null,
          state: 'QUEUE',
          publishDate: { gte: now, lte: weekAhead },
        },
      }),
      prisma.socialPost.count({
        where: {
          organizationId,
          customerId,
          deletedAt: null,
          state: 'DRAFT',
          approvalStep: 'CLIENT',
        },
      }),
      prisma.socialLead.count({
        where: { organizationId, customerId },
      }),
      countInboxWaiting(session),
      integrationIds.length
        ? prisma.socialInsightDaily.findMany({
            where: { integrationId: { in: integrationIds }, metric: 'followers' },
            orderBy: { date: 'desc' },
            distinct: ['integrationId'],
            select: { value: true },
          })
        : Promise.resolve([]),
      metaIds.length
        ? prisma.adInsightDaily.aggregate({
            where: {
              adAccountId: { in: metaIds },
              level: 'campaign',
              date: { gte: since30 },
            },
            _sum: { spend: true },
          })
        : Promise.resolve({ _sum: { spend: null } }),
      metaIds.length
        ? prisma.adInsightDaily.aggregate({
            where: {
              adAccountId: { in: metaIds },
              level: 'campaign',
              date: { gte: startOfMonth },
            },
            _sum: { spend: true },
          })
        : Promise.resolve({ _sum: { spend: null } }),
      integrationIds.length
        ? prisma.socialExternalPost.findMany({
            where: { integrationId: { in: integrationIds } },
            orderBy: { publishedAt: 'desc' },
            take: 6,
            select: {
              id: true,
              integrationId: true,
              caption: true,
              permalink: true,
              thumbnailUrl: true,
              publishedAt: true,
              likes: true,
              comments: true,
              reach: true,
            },
          })
        : Promise.resolve([]),
      integrationIds.length
        ? prisma.socialExternalPost.count({
            where: {
              integrationId: { in: integrationIds },
              publishedAt: { gte: startOfMonth },
            },
          })
        : Promise.resolve(0),
      prisma.socialLead.count({
        where: { organizationId, customerId, createdAt: { gte: startOfMonth } },
      }),
      prisma.socialAdPlanItem.count({
        where: {
          organizationId,
          customerId,
          status: 'live',
          updatedAt: { gte: startOfMonth },
        },
      }),
      prisma.socialPortalRequest.count({
        where: { organizationId, customerId, createdAt: { gte: startOfMonth } },
      }),
      shopify
        ? prisma.shopifyDailyMetric.aggregate({
            where: { organizationId, customerId, date: { gte: startOfMonth } },
            _sum: { sales: true, orders: true },
          })
        : Promise.resolve(null),
    ]);

    const followersTotal = followerRows.reduce((sum, row) => sum + Number(row.value), 0);
    const followers = integrationIds.length ? followersTotal : null;
    const spendThisMonth = Number(spendMonthAgg._sum.spend ?? 0);
    const spend30d =
      spend30Agg._sum.spend != null
        ? Number(spend30Agg._sum.spend)
        : metaIds.length
          ? 0
          : null;

    const stats: PortalOverviewStat[] = [
      {
        id: 'postsDue',
        label: 'Posts due (7d)',
        value: formatCount(postsDue),
        href: `${PORTAL_BASE_PATH}/content`,
      },
      {
        id: 'waitingApproval',
        label: 'Waiting approval',
        value: formatCount(waitingApproval),
        href: `${PORTAL_BASE_PATH}/content`,
      },
      {
        id: 'leads',
        label: 'Leads',
        value: formatCount(leadsTotal),
        href: `${PORTAL_BASE_PATH}/leads`,
      },
      {
        id: 'inboxWaiting',
        label: 'Inbox waiting',
        value: formatCount(inboxWaiting),
        href: `${PORTAL_BASE_PATH}/inbox`,
      },
    ];

    if (showSpend) {
      stats.push({
        id: 'spend30d',
        label: 'Ad spend (30d)',
        value: spend30d == null ? '—' : money.format(spend30d),
        href: `${PORTAL_BASE_PATH}/ads`,
      });
    }

    stats.push({
      id: 'followers',
      label: 'Followers',
      value: formatCount(followers),
      href: `${PORTAL_BASE_PATH}/analytics`,
    });

    const recentPosts: PortalOverviewRecentPost[] = posts.map((post) => {
      const channel = channelById.get(post.integrationId);
      return {
        id: post.id,
        caption: post.caption,
        permalink: post.permalink,
        thumbnailUrl: post.thumbnailUrl,
        publishedAt: post.publishedAt.toISOString(),
        likes: post.likes ?? 0,
        comments: post.comments ?? 0,
        reach: post.reach,
        channelName: channel?.name ?? 'Channel',
        channelPicture: channel?.picture ?? null,
      };
    });

    const thisMonth: PortalMonthHighlight[] = [];
    if (postsThisMonth > 0) {
      thisMonth.push({
        id: 'posts',
        label: 'Posts published',
        value: nf.format(postsThisMonth),
      });
    }
    if (campaignsLive > 0) {
      thisMonth.push({
        id: 'campaigns',
        label: 'Campaigns went live',
        value: nf.format(campaignsLive),
      });
    }
    if (leadsMonth > 0) {
      thisMonth.push({
        id: 'leads',
        label: 'Leads captured',
        value: nf.format(leadsMonth),
      });
    }
    if (salesMonth && (salesMonth._sum.orders ?? 0) > 0) {
      thisMonth.push({
        id: 'orders',
        label: 'Store orders',
        value: nf.format(salesMonth._sum.orders ?? 0),
      });
    }
    if (requestsMonth > 0) {
      thisMonth.push({
        id: 'requests',
        label: 'Requests you sent',
        value: nf.format(requestsMonth),
      });
    }
    if (showSpend && spendThisMonth > 0) {
      thisMonth.push({
        id: 'spend',
        label: 'Ad spend this month',
        value: money.format(spendThisMonth),
      });
    }

    const goals: PortalGoalProgress[] = [];
    if (typeof goalsConfig.leadsPerMonth === 'number' && goalsConfig.leadsPerMonth > 0) {
      goals.push({
        id: 'leads',
        label: 'Leads this month',
        current: leadsMonth,
        target: goalsConfig.leadsPerMonth,
        unit: 'count',
      });
    }
    if (typeof goalsConfig.postsPerMonth === 'number' && goalsConfig.postsPerMonth > 0) {
      goals.push({
        id: 'posts',
        label: 'Posts this month',
        current: postsThisMonth,
        target: goalsConfig.postsPerMonth,
        unit: 'count',
      });
    }
    if (
      showSpend &&
      typeof goalsConfig.adBudgetPerMonth === 'number' &&
      goalsConfig.adBudgetPerMonth > 0
    ) {
      goals.push({
        id: 'budget',
        label: 'Ad budget this month',
        current: Math.round(spendThisMonth * 100) / 100,
        target: goalsConfig.adBudgetPerMonth,
        unit: 'money',
        currency,
      });
    }

    return {
      hasChannels: integrations.length > 0,
      stats,
      recentPosts,
      thisMonth,
      goals,
      goalsConfig,
    };
  },
};
