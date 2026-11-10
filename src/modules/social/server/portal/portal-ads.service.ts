import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { organizationScope } from '@/shared/server/client-scope';
import { isPortalAdSpendVisible, parsePortalTabsConfig } from '../../config/portal-tabs';
import type { PortalSession } from '../approvals/approval.service';
import { googleAdsService } from '../google-ads/google-ads.service';

export type PortalAdsCampaign = {
  name: string;
  spend: number | null;
  impressions: number;
  clicks: number;
  leads: number;
};

export type PortalAdsSummary = {
  since: string;
  until: string;
  showSpend: boolean;
  meta: {
    accounts: { name: string; currency: string }[];
    spend: number | null;
    impressions: number;
    clicks: number;
    leads: number;
    purchases: number;
    costPerLead: number | null;
    campaigns: PortalAdsCampaign[];
  };
  google: {
    accounts: { name: string; currency: string }[];
    spend: number | null;
    impressions: number;
    clicks: number;
    conversions: number;
    campaigns: PortalAdsCampaign[];
    error: string | null;
  };
};

export const portalAdsService = {
  async summary(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    opts?: { showSpend?: boolean; days?: number }
  ): Promise<PortalAdsSummary> {
    const days = opts?.days ?? 30;
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const customer = await prisma.socialCustomer.findFirst({
      where: {
        id: session.customerId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      select: { portalTabs: true },
    });

    const [metaAccounts, googleAccounts] = await Promise.all([
      prisma.adAccount.findMany({
        where: {
          organizationId: session.organizationId,
          customerId: session.customerId,
        },
        select: { id: true, name: true, currency: true },
        orderBy: { name: 'asc' },
      }),
      prisma.socialGoogleAdsAccount.findMany({
        where: {
          organizationId: session.organizationId,
          customerId: session.customerId,
        },
        select: { name: true, currency: true, googleCustomerId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const showSpend =
      opts?.showSpend !== undefined
        ? opts.showSpend
        : isPortalAdSpendVisible({
            hasChannels: true,
            hasAds: metaAccounts.length > 0 || googleAccounts.length > 0,
            hasShopify: false,
            hasLeadSources: true,
            portalTabs: parsePortalTabsConfig(customer?.portalTabs),
          });

    const accountIds = metaAccounts.map((row) => row.id);
    let spend: number | null = showSpend ? 0 : null;
    let impressions = 0;
    let clicks = 0;
    let leads = 0;
    let purchases = 0;
    const campaigns: PortalAdsCampaign[] = [];

    if (accountIds.length > 0) {
      const [totals, byCampaign] = await Promise.all([
        prisma.adInsightDaily.aggregate({
          where: {
            adAccountId: { in: accountIds },
            level: 'campaign',
            date: { gte: since, lte: until },
          },
          _sum: {
            spend: true,
            impressions: true,
            clicks: true,
            leads: true,
            purchases: true,
          },
        }),
        prisma.adInsightDaily.groupBy({
          by: ['entityId'],
          where: {
            adAccountId: { in: accountIds },
            level: 'campaign',
            date: { gte: since, lte: until },
          },
          _sum: {
            spend: true,
            impressions: true,
            clicks: true,
            leads: true,
          },
          orderBy: { _sum: { spend: 'desc' } },
          take: 10,
        }),
      ]);

      if (showSpend) {
        spend = totals._sum.spend != null ? Number(totals._sum.spend) : 0;
      }
      impressions = Number(totals._sum.impressions ?? 0);
      clicks = totals._sum.clicks ?? 0;
      leads = totals._sum.leads ?? 0;
      purchases = totals._sum.purchases ?? 0;

      const entityIds = byCampaign.map((row) => row.entityId);
      const names = entityIds.length
        ? await prisma.adEntity.findMany({
            where: {
              adAccountId: { in: accountIds },
              level: 'campaign',
              externalId: { in: entityIds },
            },
            select: { externalId: true, name: true },
          })
        : [];
      const nameById = new Map(names.map((row) => [row.externalId, row.name]));

      for (const row of byCampaign) {
        campaigns.push({
          name: nameById.get(row.entityId) ?? 'Campaign',
          spend: showSpend ? Number(row._sum.spend ?? 0) : null,
          impressions: Number(row._sum.impressions ?? 0),
          clicks: row._sum.clicks ?? 0,
          leads: row._sum.leads ?? 0,
        });
      }
    }

    const costPerLead =
      showSpend && spend != null && leads > 0 ? Math.round((spend / leads) * 100) / 100 : null;

    let googleSpend: number | null = showSpend ? 0 : null;
    let googleImpressions = 0;
    let googleClicks = 0;
    let googleConversions = 0;
    const googleCampaigns: PortalAdsCampaign[] = [];
    let googleError: string | null = null;

    if (googleAccounts.length > 0) {
      const scope = organizationScope(session.organizationId, session.customerId);
      try {
        // Soft-live pull for the first linked account; never expose googleCustomerId.
        const overview = await googleAdsService.overview(scope, googleAccounts[0]!.googleCustomerId, {
          mode: 'preset',
          datePreset: 'last_30d',
        });
        if (showSpend) googleSpend = overview.totals.spend;
        googleImpressions = overview.totals.impressions;
        googleClicks = overview.totals.clicks;
        googleConversions = overview.totals.leads;
        for (const campaign of overview.campaigns.slice(0, 10)) {
          googleCampaigns.push({
            name: campaign.name,
            spend: showSpend ? campaign.spend : null,
            impressions: campaign.impressions,
            clicks: campaign.clicks,
            leads: campaign.leads,
          });
        }
      } catch (error) {
        googleError = error instanceof Error ? error.message : 'Could not load Google Ads right now';
        googleSpend = showSpend ? null : null;
      }
    }

    return {
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
      showSpend,
      meta: {
        accounts: metaAccounts.map((row) => ({ name: row.name, currency: row.currency })),
        spend,
        impressions,
        clicks,
        leads,
        purchases,
        costPerLead,
        campaigns,
      },
      google: {
        accounts: googleAccounts.map((row) => ({ name: row.name, currency: row.currency })),
        spend: googleSpend,
        impressions: googleImpressions,
        clicks: googleClicks,
        conversions: googleConversions,
        campaigns: googleCampaigns,
        error: googleError,
      },
    };
  },
};
