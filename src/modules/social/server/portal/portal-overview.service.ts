import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { isPortalAdSpendVisible, parsePortalTabsConfig } from '../../config/portal-tabs';
import type { PortalSession } from '../approvals/approval.service';
import { parsePortalGoals, type PortalGoalsConfig } from './portal-goals.schema';

export type PortalOverviewStat = { label: string; value: string };

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

export const portalOverviewService = {
  async get(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalOverviewDto> {
    const { organizationId, customerId } = session;
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
      portalTabs: parsePortalTabsConfig(customer?.portalTabs),
    });

    const integrationIds = integrations.map((row) => row.id);
    const channelById = new Map(integrations.map((row) => [row.id, row]));
    const nf = new Intl.NumberFormat();
    const stats: PortalOverviewStat[] = [];
    let recentPosts: PortalOverviewRecentPost[] = [];
    let postsThisMonth = 0;

    if (integrationIds.length > 0) {
      const [followers, insights, posts, postsCount] = await Promise.all([
        prisma.socialInsightDaily.findMany({
          where: { integrationId: { in: integrationIds }, metric: 'followers' },
          orderBy: { date: 'desc' },
          distinct: ['integrationId'],
          select: { value: true },
        }),
        prisma.socialInsightDaily.findMany({
          where: {
            integrationId: { in: integrationIds },
            date: { gte: since30 },
            metric: { in: ['reach', 'impressions'] },
          },
          select: { metric: true, value: true },
        }),
        prisma.socialExternalPost.findMany({
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
        }),
        prisma.socialExternalPost.count({
          where: {
            integrationId: { in: integrationIds },
            publishedAt: { gte: startOfMonth },
          },
        }),
      ]);

      postsThisMonth = postsCount;
      const totalFollowers = followers.reduce((sum, row) => sum + Number(row.value), 0);
      const reach30 = insights
        .filter((row) => row.metric === 'reach')
        .reduce((sum, row) => sum + Number(row.value), 0);
      if (totalFollowers > 0) stats.push({ label: 'Total audience', value: nf.format(totalFollowers) });
      if (reach30 > 0) stats.push({ label: 'Reach (30 days)', value: nf.format(reach30) });
      stats.push({ label: 'Posts this month', value: nf.format(postsThisMonth) });

      recentPosts = posts.map((post) => {
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
    }

    const metaIds = metaAccounts.map((row) => row.id);
    const currency = metaAccounts[0]?.currency ?? shopify?.currency ?? 'INR';
    const money = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });

    let spendThisMonth = 0;
    if (metaIds.length > 0) {
      const spendAgg = await prisma.adInsightDaily.aggregate({
        where: {
          adAccountId: { in: metaIds },
          level: 'campaign',
          date: { gte: startOfMonth },
        },
        _sum: { spend: true },
      });
      spendThisMonth = Number(spendAgg._sum.spend ?? 0);
    }

    if (showSpend && metaIds.length > 0) {
      const spend30 = await prisma.adInsightDaily.aggregate({
        where: {
          adAccountId: { in: metaIds },
          level: 'campaign',
          date: { gte: since30 },
        },
        _sum: { spend: true },
      });
      stats.push({
        label: 'Ad spend (30 days)',
        value: money.format(Number(spend30._sum.spend ?? 0)),
      });
    }

    const [leadsMonth, leads30, campaignsLive, requestsMonth, salesMonth, sales30] =
      await Promise.all([
        prisma.socialLead.count({
          where: { organizationId, customerId, createdAt: { gte: startOfMonth } },
        }),
        prisma.socialLead.count({
          where: { organizationId, customerId, createdAt: { gte: since30 } },
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
        shopify
          ? prisma.shopifyDailyMetric.aggregate({
              where: { organizationId, customerId, date: { gte: since30 } },
              _sum: { sales: true, orders: true },
            })
          : Promise.resolve(null),
      ]);

    if (leads30 > 0 || metaIds.length > 0 || googleCount > 0) {
      stats.push({ label: 'Leads (30 days)', value: nf.format(leads30) });
    }

    if (shopify && sales30) {
      stats.push({
        label: 'Sales (30 days)',
        value: money.format(Number(sales30._sum.sales ?? 0)),
      });
      stats.push({
        label: 'Orders (30 days)',
        value: nf.format(sales30._sum.orders ?? 0),
      });
    }

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
