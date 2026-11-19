import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { isPortalAdSpendVisible } from '../../config/portal-tabs';
import { getSettings } from '../growth/growth.service';
import { localDay, reportDue, roas } from '../growth/growth-metrics';
import type { PortalSession } from '../approvals/approval.service';
import { portalTabsService } from './portal-tabs.service';
import {
  portalSalesService,
  type PortalSalesSummary,
  type PortalShopifySummary,
  type PortalWebsiteSummary,
} from './portal-sales.service';

export type PortalGrowthHero = {
  since: string;
  until: string;
  currency: string;
  storeConnected: boolean;
  /** B3: clear note when Shopify is missing but ads/GA4 still show. */
  storeNote: string | null;
  showSpend: boolean;
  /** Lead/website desk when Shopify is off and Meta leads (or ads) are the story. */
  websiteMode: boolean;
  usingShopifyRoas: boolean;
  targetRoas: number;
  targetCpl: number;
  roas: number | null;
  cpl: number | null;
  onTarget: boolean | null;
  hasAds: boolean;
  kpis: {
    posts: number;
    orders: number | null;
    sales: number | null;
    aov: number | null;
    spend: number | null;
    metaSpend: number | null;
    sessions: number | null;
    leads: number;
    purchases: number;
    pendingCampaigns: number;
    approvedCampaigns: number;
    draftBlogs: number;
    reportDue: boolean;
  };
  shopify: PortalShopifySummary;
  website: PortalWebsiteSummary | null;
};

export type PortalAdsDay = {
  date: string;
  spend: number | null;
  purchases: number;
  revenue: number | null;
  leads: number;
};

export type PortalAdsCampaign = {
  name: string;
  status: string;
  spend: number | null;
  purchases: number;
  revenue: number | null;
  leads: number;
  roas: number | null;
};

export type PortalGrowthPerformance = {
  since: string;
  until: string;
  currency: string;
  storeConnected: boolean;
  storeNote: string | null;
  showSpend: boolean;
  shopify: PortalShopifySummary;
  ads: {
    connected: boolean;
    totals: {
      spend: number | null;
      purchases: number;
      revenue: number | null;
      leads: number;
      roas: number | null;
    };
    days: PortalAdsDay[];
    campaigns: PortalAdsCampaign[];
  };
};

export type PortalGrowthOverview = {
  hero: PortalGrowthHero;
  performance: PortalGrowthPerformance;
  sales: PortalSalesSummary;
};

function period(daysBack = 30) {
  const until = new Date();
  until.setHours(0, 0, 0, 0);
  const since = new Date(until);
  since.setDate(since.getDate() - (daysBack - 1));
  return { since, until, daysBack };
}

/**
 * Client-portal Growth desk (tab id `sales`): hero KPIs + performance.
 * Org + customer only from session. Spend only when adSpendVisible.
 */
export const portalGrowthService = {
  async overview(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    opts?: { days?: number }
  ): Promise<PortalGrowthOverview> {
    const { since, until, daysBack } = period(opts?.days ?? 30);
    const org = session.organizationId;
    const customerId = session.customerId;

    const [sales, settings, flags, metaAccounts, postsCount, pendingAds, approvedAds, draftBlogs, lastReport] =
      await Promise.all([
        portalSalesService.summary(session, { days: daysBack }),
        getSettings(org, customerId),
        portalTabsService.getClientFlags(org, customerId),
        prisma.adAccount.findMany({
          where: { organizationId: org, customerId },
          select: { id: true },
        }),
        prisma.socialPost.count({
          where: {
            organizationId: org,
            customerId,
            deletedAt: null,
            parentPostId: null,
            state: 'PUBLISHED',
            publishDate: { gte: since, lte: until },
          },
        }),
        prisma.socialAdPlanItem.count({
          where: { organizationId: org, customerId, status: 'pending' },
        }),
        prisma.socialAdPlanItem.count({
          where: { organizationId: org, customerId, status: 'approved' },
        }),
        prisma.socialBlog.count({
          where: { organizationId: org, customerId, status: { in: ['draft', 'changes'] } },
        }),
        prisma.socialGrowthReport.findFirst({
          where: { organizationId: org, customerId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

    const showSpend = isPortalAdSpendVisible(flags);
    const storeConnected = sales.shopify.connected;
    const storeNote = storeConnected
      ? null
      : 'Store not connected — showing ads and website analytics only.';

    const accountIds = metaAccounts.map((row) => row.id);
    let adsDays: PortalAdsDay[] = [];
    let campaigns: PortalAdsCampaign[] = [];
    let adsSpend: number | null = showSpend ? 0 : null;
    let adsPurchases = 0;
    let adsRevenue: number | null = showSpend ? 0 : null;
    let adsLeads = 0;

    if (accountIds.length > 0) {
      const [dayRows, byCampaign] = await Promise.all([
        prisma.adInsightDaily.groupBy({
          by: ['date'],
          where: {
            adAccountId: { in: accountIds },
            level: 'campaign',
            date: { gte: since, lte: until },
          },
          _sum: { spend: true, purchases: true, purchaseValue: true, leads: true },
        }),
        prisma.adInsightDaily.groupBy({
          by: ['entityId'],
          where: {
            adAccountId: { in: accountIds },
            level: 'campaign',
            date: { gte: since, lte: until },
          },
          _sum: { spend: true, purchases: true, purchaseValue: true, leads: true },
        }),
      ]);

      adsDays = dayRows
        .map((row) => {
          const spend = Number(row._sum.spend ?? 0);
          const revenue = Number(row._sum.purchaseValue ?? 0);
          const purchases = row._sum.purchases ?? 0;
          const leads = row._sum.leads ?? 0;
          return {
            date: row.date.toISOString().slice(0, 10),
            spend: showSpend ? Math.round(spend * 100) / 100 : null,
            purchases,
            revenue: showSpend ? Math.round(revenue * 100) / 100 : null,
            leads,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      if (showSpend) {
        adsSpend = Math.round(adsDays.reduce((sum, d) => sum + (d.spend ?? 0), 0) * 100) / 100;
        adsRevenue = Math.round(adsDays.reduce((sum, d) => sum + (d.revenue ?? 0), 0) * 100) / 100;
      }
      adsPurchases = adsDays.reduce((sum, d) => sum + d.purchases, 0);
      adsLeads = adsDays.reduce((sum, d) => sum + d.leads, 0);

      const entities = byCampaign.length
        ? await prisma.adEntity.findMany({
            where: {
              adAccountId: { in: accountIds },
              level: 'campaign',
              externalId: { in: byCampaign.map((r) => r.entityId) },
            },
            select: { externalId: true, name: true, status: true },
          })
        : [];
      const nameBy = new Map(entities.map((e) => [e.externalId, e]));

      campaigns = byCampaign
        .map((row) => {
          const spend = Number(row._sum.spend ?? 0);
          const revenue = Number(row._sum.purchaseValue ?? 0);
          const purchases = row._sum.purchases ?? 0;
          const leads = row._sum.leads ?? 0;
          const meta = nameBy.get(row.entityId);
          return {
            name: meta?.name ?? 'Campaign',
            status: meta?.status ?? 'UNKNOWN',
            spend: showSpend ? Math.round(spend * 100) / 100 : null,
            purchases,
            revenue: showSpend ? Math.round(revenue * 100) / 100 : null,
            leads,
            roas: showSpend ? roas(revenue, spend) : null,
          };
        })
        .filter((c) => (c.spend ?? 0) > 0 || c.purchases > 0 || c.leads > 0)
        .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0))
        .slice(0, 20);
    }

    const hasAds = accountIds.length > 0;
    const metaSpend = showSpend ? adsSpend : null;
    const heroRoas = showSpend
      ? storeConnected
        ? sales.shopify.totals.roas
        : roas(adsRevenue, adsSpend)
      : null;
    const targetRoas = settings.targetRoas;
    const targetCpl = settings.targetCpl ?? 200;
    const cpl =
      showSpend && adsLeads > 0 && metaSpend != null && metaSpend > 0
        ? Math.round((metaSpend / adsLeads) * 100) / 100
        : null;
    const websiteMode = !storeConnected && (adsLeads > 0 || hasAds);
    const usingShopifyRoas = storeConnected && sales.shopify.totals.roas != null;
    const tz = 'Asia/Kolkata';
    const due = reportDue(
      lastReport ? localDay(lastReport.createdAt, tz) : null,
      localDay(new Date(), tz),
      settings.reportEveryDays ?? 15
    );

    const hero: PortalGrowthHero = {
      since: sales.shopify.since,
      until: sales.shopify.until,
      currency: sales.shopify.currency,
      storeConnected,
      storeNote,
      showSpend,
      websiteMode,
      usingShopifyRoas,
      targetRoas,
      targetCpl,
      roas: heroRoas,
      cpl,
      onTarget: websiteMode
        ? cpl == null
          ? null
          : cpl <= targetCpl
        : heroRoas == null
          ? null
          : heroRoas >= targetRoas,
      hasAds,
      kpis: {
        posts: postsCount,
        orders: storeConnected ? sales.shopify.totals.orders : null,
        sales: storeConnected ? sales.shopify.totals.sales : null,
        aov: storeConnected ? sales.shopify.totals.aov : null,
        spend: showSpend ? (storeConnected ? sales.shopify.totals.spend : adsSpend) : null,
        metaSpend,
        sessions: sales.website?.sessions ?? null,
        leads: adsLeads,
        purchases: adsPurchases,
        pendingCampaigns: pendingAds,
        approvedCampaigns: approvedAds,
        draftBlogs,
        reportDue: due.due,
      },
      shopify: sales.shopify,
      website: sales.website,
    };

    const performance: PortalGrowthPerformance = {
      since: sales.shopify.since,
      until: sales.shopify.until,
      currency: sales.shopify.currency,
      storeConnected,
      storeNote,
      showSpend,
      shopify: sales.shopify,
      ads: {
        connected: accountIds.length > 0,
        totals: {
          spend: adsSpend,
          purchases: adsPurchases,
          revenue: adsRevenue,
          leads: adsLeads,
          roas: showSpend ? roas(adsRevenue, adsSpend) : null,
        },
        days: adsDays,
        campaigns,
      },
    };

    return { hero, performance, sales };
  },
};
