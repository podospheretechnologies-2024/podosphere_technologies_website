import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { isPortalAdSpendVisible } from '../../config/portal-tabs';
import { roas } from '../growth/growth-metrics';
import { shopifyService } from '../growth/shopify.service';
import type { PortalSession } from '../approvals/approval.service';
import { portalTabsService } from './portal-tabs.service';

export type PortalSalesDay = {
  date: string;
  orders: number;
  sales: number;
  spend: number | null;
};

export type PortalSalesSummary = {
  connected: boolean;
  shopName: string | null;
  currency: string;
  since: string;
  until: string;
  showSpend: boolean;
  totals: {
    orders: number;
    sales: number;
    spend: number | null;
    roas: number | null;
    aov: number | null;
  };
  days: PortalSalesDay[];
};

/**
 * Client-portal Sales: Shopify daily metrics for this session's client only.
 * Ad spend (for ROAS) only when `adSpendVisible` is on.
 */
export const portalSalesService = {
  async summary(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    opts?: { days?: number }
  ): Promise<PortalSalesSummary> {
    const daysBack = opts?.days ?? 30;
    const until = new Date();
    until.setHours(0, 0, 0, 0);
    const since = new Date(until);
    since.setDate(since.getDate() - (daysBack - 1));

    const [store, flags, storeRows, metaAccounts] = await Promise.all([
      shopifyService.get(session.organizationId, session.customerId),
      portalTabsService.getClientFlags(session.organizationId, session.customerId),
      prisma.shopifyDailyMetric.findMany({
        where: {
          organizationId: session.organizationId,
          customerId: session.customerId,
          date: { gte: since, lte: until },
        },
        orderBy: { date: 'asc' },
        select: { date: true, orders: true, sales: true },
      }),
      prisma.adAccount.findMany({
        where: {
          organizationId: session.organizationId,
          customerId: session.customerId,
        },
        select: { id: true },
      }),
    ]);

    const showSpend = isPortalAdSpendVisible(flags);
    const accountIds = metaAccounts.map((row) => row.id);

    let spendByDay = new Map<string, number>();
    let totalSpend: number | null = showSpend ? 0 : null;

    if (showSpend && accountIds.length > 0) {
      const adRows = await prisma.adInsightDaily.groupBy({
        by: ['date'],
        where: {
          adAccountId: { in: accountIds },
          level: 'campaign',
          date: { gte: since, lte: until },
        },
        _sum: { spend: true },
      });
      spendByDay = new Map(
        adRows.map((row) => [row.date.toISOString().slice(0, 10), Number(row._sum.spend ?? 0)])
      );
      totalSpend = [...spendByDay.values()].reduce((sum, value) => sum + value, 0);
      totalSpend = Math.round(totalSpend * 100) / 100;
    }

    const days: PortalSalesDay[] = storeRows.map((row) => {
      const date = row.date.toISOString().slice(0, 10);
      return {
        date,
        orders: row.orders,
        sales: Number(row.sales),
        spend: showSpend ? (spendByDay.get(date) ?? 0) : null,
      };
    });

    const orders = days.reduce((sum, day) => sum + day.orders, 0);
    const sales = Math.round(days.reduce((sum, day) => sum + day.sales, 0) * 100) / 100;

    return {
      connected: store.connected,
      shopName: store.shopName,
      currency: store.currency || 'INR',
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
      showSpend,
      totals: {
        orders,
        sales,
        spend: totalSpend,
        roas: showSpend ? roas(sales, totalSpend) : null,
        aov: orders > 0 ? Math.round((sales / orders) * 100) / 100 : null,
      },
      days,
    };
  },
};
