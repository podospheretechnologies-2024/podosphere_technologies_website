import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import type { GrowthClient } from './growth-scope';
import { dayToDate, daysBetween, localDay, reportDue, roas, shiftDay } from './growth-metrics';
import { shopifyService } from './shopify.service';

const MAX_RANGE_DAYS = 400;

export interface GrowthSettingsDto {
  targetRoas: number;
  dailyBudget: number | null;
  budgetCap: number | null;
  blogsPerMonth: number;
  reportEveryDays: number;
  contentSheetUrl: string | null;
  brandContext: string | null;
  insightsEnabled: boolean;
  lastInsightsAt: string | null;
}

const num = (v: { toNumber(): number } | null | undefined): number | null => (v == null ? null : v.toNumber());

export async function getSettings(organizationId: string, customerId: string): Promise<GrowthSettingsDto> {
  const row = await prisma.socialGrowthSettings.findFirst({ where: { organizationId, customerId } });
  return {
    targetRoas: num(row?.targetRoas) ?? 10,
    dailyBudget: num(row?.dailyBudget),
    budgetCap: num(row?.budgetCap),
    blogsPerMonth: row?.blogsPerMonth ?? 5,
    reportEveryDays: row?.reportEveryDays ?? 15,
    contentSheetUrl: row?.contentSheetUrl ?? null,
    brandContext: row?.brandContext ?? null,
    insightsEnabled: row?.insightsEnabled ?? true,
    lastInsightsAt: row?.lastInsightsAt?.toISOString() ?? null,
  };
}

export async function updateSettings(
  gc: GrowthClient,
  input: Partial<Omit<GrowthSettingsDto, 'lastInsightsAt'>>
): Promise<GrowthSettingsDto> {
  const current = await getSettings(gc.organizationId, gc.customerId);
  const next = { ...current, ...input };
  if (next.dailyBudget != null && next.budgetCap != null && next.dailyBudget > next.budgetCap) {
    throw new HttpError(400, 'The daily budget is above the budget cap.');
  }
  const data = {
    targetRoas: next.targetRoas.toFixed(2),
    dailyBudget: next.dailyBudget == null ? null : next.dailyBudget.toFixed(2),
    budgetCap: next.budgetCap == null ? null : next.budgetCap.toFixed(2),
    blogsPerMonth: next.blogsPerMonth,
    reportEveryDays: next.reportEveryDays,
    contentSheetUrl: next.contentSheetUrl || null,
    brandContext: next.brandContext || null,
    insightsEnabled: next.insightsEnabled,
  };
  await prisma.socialGrowthSettings.upsert({
    where: { customerId: gc.customerId },
    update: data,
    create: { organizationId: gc.organizationId, customerId: gc.customerId, ...data },
  });
  return getSettings(gc.organizationId, gc.customerId);
}

export interface DailyRow {
  date: string;
  orders: number | null;
  sales: number | null;
  sessions: number | null;
  atc: number | null;
  spend: number | null;
  metaPurchases: number | null;
  metaRevenue: number | null;
}

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  costPerPurchase: number | null;
  ctr: number | null;
  atc: number;
}

async function customerAdAccountIds(organizationId: string, customerId: string): Promise<string[]> {
  const accounts = await prisma.adAccount.findMany({
    where: { organizationId, customerId },
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

export async function resolveRange(
  organizationId: string,
  customerId: string,
  preset: string | null,
  fromRaw: string | null,
  toRaw: string | null,
  timeZone: string
): Promise<{ from: string; to: string; label: string }> {
  const today = localDay(new Date(), timeZone);
  const isDay = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  if (preset === 'custom' && isDay(fromRaw) && isDay(toRaw)) {
    const from = fromRaw <= toRaw ? fromRaw : toRaw;
    const to = fromRaw <= toRaw ? toRaw : fromRaw;
    if (daysBetween(from, to).length > MAX_RANGE_DAYS) throw new HttpError(400, `Pick at most ${MAX_RANGE_DAYS} days.`);
    return { from, to, label: 'Custom' };
  }
  if (preset === '30d') return { from: shiftDay(today, -29), to: today, label: 'Last 30 days' };
  if (preset === 'month') return { from: `${today.slice(0, 8)}01`, to: today, label: 'This month' };
  if (preset === 'life') {
    const accountIds = await customerAdAccountIds(organizationId, customerId);
    const [firstStore, firstAd] = await Promise.all([
      prisma.shopifyDailyMetric.findFirst({ where: { organizationId, customerId }, orderBy: { date: 'asc' }, select: { date: true } }),
      accountIds.length
        ? prisma.adInsightDaily.findFirst({
            where: { adAccountId: { in: accountIds }, level: 'campaign' },
            orderBy: { date: 'asc' },
            select: { date: true },
          })
        : null,
    ]);
    const candidates = [firstStore?.date, firstAd?.date].filter(Boolean) as Date[];
    const earliest = candidates.length
      ? candidates.reduce((a, b) => (a < b ? a : b)).toISOString().slice(0, 10)
      : shiftDay(today, -89);
    const from = daysBetween(earliest, today).length > MAX_RANGE_DAYS ? shiftDay(today, -(MAX_RANGE_DAYS - 1)) : earliest;
    return { from, to: today, label: 'Lifetime' };
  }
  return { from: shiftDay(today, -6), to: today, label: 'Last 7 days' };
}

export async function overview(
  gc: GrowthClient,
  params: { preset: string | null; from: string | null; to: string | null }
) {
  const { organizationId, customerId } = gc;
  const [store, settings] = await Promise.all([
    shopifyService.get(organizationId, customerId),
    getSettings(organizationId, customerId),
  ]);
  const timeZone = store.timeZone ?? 'Asia/Kolkata';
  const range = await resolveRange(organizationId, customerId, params.preset, params.from, params.to, timeZone);
  const fromDate = dayToDate(range.from);
  const toDate = dayToDate(range.to);
  const accountIds = await customerAdAccountIds(organizationId, customerId);

  const [storeRows, adByDay, adByCampaign] = await Promise.all([
    prisma.shopifyDailyMetric.findMany({
      where: { organizationId, customerId, date: { gte: fromDate, lte: toDate } },
    }),
    accountIds.length
      ? prisma.adInsightDaily.groupBy({
          by: ['date'],
          where: { adAccountId: { in: accountIds }, level: 'campaign', date: { gte: fromDate, lte: toDate } },
          _sum: { spend: true, purchases: true, purchaseValue: true },
        })
      : Promise.resolve([]),
    accountIds.length
      ? prisma.adInsightDaily.groupBy({
          by: ['entityId'],
          where: { adAccountId: { in: accountIds }, level: 'campaign', date: { gte: fromDate, lte: toDate } },
          _sum: { spend: true, purchases: true, purchaseValue: true, clicks: true, impressions: true, addToCart: true },
        })
      : Promise.resolve([]),
  ]);

  const storeByDay = new Map(storeRows.map((r) => [r.date.toISOString().slice(0, 10), r]));
  const adDay = new Map(adByDay.map((r) => [r.date.toISOString().slice(0, 10), r._sum]));
  const hasStore = store.connected;
  const hasAds = accountIds.length > 0;

  const days: DailyRow[] = daysBetween(range.from, range.to).map((date) => {
    const s = storeByDay.get(date);
    const a = adDay.get(date);
    return {
      date,
      orders: hasStore ? (s?.orders ?? null) : null,
      sales: hasStore ? (s ? s.sales.toNumber() : null) : null,
      sessions: s?.sessions ?? null,
      atc: s?.addToCart ?? null,
      spend: hasAds ? (a?.spend?.toNumber() ?? 0) : null,
      metaPurchases: hasAds ? (a?.purchases ?? 0) : null,
      metaRevenue: hasAds ? (a?.purchaseValue?.toNumber() ?? 0) : null,
    };
  });

  const sum = (key: keyof DailyRow): number | null => {
    let total = 0;
    let any = false;
    for (const d of days) {
      const v = d[key];
      if (typeof v === 'number') {
        total += v;
        any = true;
      }
    }
    return any ? Math.round(total * 100) / 100 : null;
  };

  const entities = adByCampaign.length
    ? await prisma.adEntity.findMany({
        where: {
          adAccountId: { in: accountIds },
          level: 'campaign',
          externalId: { in: adByCampaign.map((r) => r.entityId) },
        },
        select: { externalId: true, name: true, status: true, objective: true },
      })
    : [];
  const entityById = new Map(entities.map((e) => [e.externalId, e]));
  const campaigns: CampaignRow[] = adByCampaign
    .map((r) => {
      const e = entityById.get(r.entityId);
      const spend = r._sum.spend?.toNumber() ?? 0;
      const purchases = r._sum.purchases ?? 0;
      const revenue = r._sum.purchaseValue?.toNumber() ?? 0;
      const impressions = Number(r._sum.impressions ?? 0);
      const clicks = r._sum.clicks ?? 0;
      return {
        id: r.entityId,
        name: e?.name ?? r.entityId,
        status: e?.status ?? 'UNKNOWN',
        objective: e?.objective ?? null,
        spend,
        purchases,
        revenue,
        roas: roas(revenue, spend),
        costPerPurchase: purchases ? Math.round((spend / purchases) * 100) / 100 : null,
        ctr: impressions ? clicks / impressions : null,
        atc: r._sum.addToCart ?? 0,
      };
    })
    .filter((c) => c.spend > 0 || c.purchases > 0)
    .sort((a, b) => b.spend - a.spend);

  const totals = {
    sales: sum('sales'),
    orders: sum('orders'),
    sessions: sum('sessions'),
    atc: sum('atc'),
    spend: sum('spend'),
    metaPurchases: sum('metaPurchases'),
    metaRevenue: sum('metaRevenue'),
  };

  return {
    client: { id: customerId, name: gc.customerName },
    range,
    store,
    settings,
    hasAds,
    totals: {
      ...totals,
      roas: roas(totals.sales, totals.spend),
      metaRoas: roas(totals.metaRevenue, totals.spend),
      aov: totals.orders ? Math.round(((totals.sales ?? 0) / totals.orders) * 100) / 100 : null,
    },
    days,
    campaigns,
    counts: await deskCounts(organizationId, customerId, settings.reportEveryDays, timeZone),
  };
}

export async function deskCounts(organizationId: string, customerId: string, reportEveryDays: number, timeZone: string) {
  const [tasks, ads, blogs, lastReport] = await Promise.all([
    prisma.socialTask.groupBy({ by: ['status'], where: { organizationId, customerId }, _count: { _all: true } }),
    prisma.socialAdPlanItem.groupBy({ by: ['status'], where: { organizationId, customerId }, _count: { _all: true } }),
    prisma.socialBlog.groupBy({ by: ['status'], where: { organizationId, customerId }, _count: { _all: true } }),
    prisma.socialGrowthReport.findFirst({
      where: { organizationId, customerId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  const count = (rows: { status: string; _count: { _all: number } }[], status: string) =>
    rows.find((r) => r.status === status)?._count._all ?? 0;
  const today = localDay(new Date(), timeZone);
  const due = reportDue(lastReport ? localDay(lastReport.createdAt, timeZone) : null, today, reportEveryDays);
  return {
    openTasks: count(tasks, 'todo'),
    reviewTasks: count(tasks, 'review'),
    pendingAds: count(ads, 'pending'),
    approvedAds: count(ads, 'approved'),
    draftBlogs: count(blogs, 'draft'),
    approvedBlogs: count(blogs, 'approved'),
    reportDue: due.due,
    nextReportDue: due.nextDue,
  };
}

/** "All clients" view: one row per client with last-7-day numbers. */
export async function clientsSummary(scope: ClientScope) {
  const customers = await prisma.socialCustomer.findMany({
    where: {
      organizationId: scope.organizationId,
      deletedAt: null,
      ...(scope.customerIds === 'all' ? {} : { id: { in: scope.customerIds } }),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (!customers.length) return [];
  const ids = customers.map((c) => c.id);
  const today = localDay(new Date(), 'Asia/Kolkata');
  const from = dayToDate(shiftDay(today, -6));
  const to = dayToDate(today);

  const [stores, sales, accounts, tasks, settings] = await Promise.all([
    prisma.socialShopifyStore.findMany({
      where: { organizationId: scope.organizationId, customerId: { in: ids } },
      select: { customerId: true, status: true },
    }),
    prisma.shopifyDailyMetric.groupBy({
      by: ['customerId'],
      where: { organizationId: scope.organizationId, customerId: { in: ids }, date: { gte: from, lte: to } },
      _sum: { sales: true, orders: true },
    }),
    prisma.adAccount.findMany({
      where: { organizationId: scope.organizationId, customerId: { in: ids } },
      select: { id: true, customerId: true },
    }),
    prisma.socialTask.groupBy({
      by: ['customerId', 'status'],
      where: { organizationId: scope.organizationId, customerId: { in: ids }, status: { in: ['todo', 'review'] } },
      _count: { _all: true },
    }),
    prisma.socialGrowthSettings.findMany({
      where: { organizationId: scope.organizationId, customerId: { in: ids } },
      select: { customerId: true, targetRoas: true },
    }),
  ]);
  const spendRows = accounts.length
    ? await prisma.adInsightDaily.groupBy({
        by: ['adAccountId'],
        where: { adAccountId: { in: accounts.map((a) => a.id) }, level: 'campaign', date: { gte: from, lte: to } },
        _sum: { spend: true, purchaseValue: true },
      })
    : [];
  const accountCustomer = new Map(accounts.map((a) => [a.id, a.customerId]));
  const spendByCustomer = new Map<string, { spend: number; metaRevenue: number }>();
  for (const row of spendRows) {
    const cid = accountCustomer.get(row.adAccountId);
    if (!cid) continue;
    const prev = spendByCustomer.get(cid) ?? { spend: 0, metaRevenue: 0 };
    prev.spend += row._sum.spend?.toNumber() ?? 0;
    prev.metaRevenue += row._sum.purchaseValue?.toNumber() ?? 0;
    spendByCustomer.set(cid, prev);
  }

  return customers.map((c) => {
    const store = stores.find((s) => s.customerId === c.id);
    const s = sales.find((r) => r.customerId === c.id);
    const sp = spendByCustomer.get(c.id);
    const salesTotal = s?._sum.sales?.toNumber() ?? null;
    return {
      id: c.id,
      name: c.name,
      storeConnected: Boolean(store),
      storeStatus: store?.status ?? null,
      hasAds: accounts.some((a) => a.customerId === c.id),
      sales7d: store ? (salesTotal ?? 0) : null,
      orders7d: store ? (s?._sum.orders ?? 0) : null,
      spend7d: sp ? Math.round(sp.spend) : null,
      roas7d: store && sp ? roas(salesTotal ?? 0, sp.spend) : null,
      metaRoas7d: sp ? roas(sp.metaRevenue, sp.spend) : null,
      targetRoas: settings.find((x) => x.customerId === c.id)?.targetRoas.toNumber() ?? 10,
      openTasks: tasks.find((t) => t.customerId === c.id && t.status === 'todo')?._count._all ?? 0,
      reviewTasks: tasks.find((t) => t.customerId === c.id && t.status === 'review')?._count._all ?? 0,
    };
  });
}
