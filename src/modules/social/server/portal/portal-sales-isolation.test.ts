import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../growth/shopify.service', () => ({
  shopifyService: {
    get: vi.fn().mockResolvedValue({
      connected: true,
      shopName: 'Demo',
      currency: 'INR',
    }),
  },
}));
vi.mock('../growth/ga4.service', () => ({
  ga4Service: {
    website: vi.fn().mockResolvedValue({
      property: {
        propertyId: 'props/1',
        displayName: 'Acme Web',
        accountName: null,
        currency: 'INR',
        timeZone: 'Asia/Kolkata',
        status: 'active',
        lastError: null,
        lastSyncedAt: null,
      },
      snapshot: {
        periodStart: '2026-10-18',
        periodEnd: '2026-11-17',
        totals: {
          sessions: 1200,
          totalUsers: 900,
          newUsers: 400,
          engagedSessions: 700,
          addToCarts: 80,
          checkouts: 40,
          purchases: 20,
          revenue: 50000,
          keyEvents: 20,
        },
        channels: [],
        sources: [],
        landing: [],
        devices: [],
        updatedAt: '2026-11-17T00:00:00.000Z',
      },
    }),
  },
}));
vi.mock('./portal-tabs.service', () => ({
  portalTabsService: {
    getClientFlags: vi.fn().mockResolvedValue({
      hasChannels: false,
      hasAds: true,
      hasShopify: true,
      hasLeadSources: true,
      hasWhatsApp: false,
      portalTabs: null,
    }),
  },
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue([]),
  });
  return {
    prisma: {
      shopifyDailyMetric: model(),
      adAccount: model(),
      adInsightDaily: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { ga4Service } from '../growth/ga4.service';
import { portalSalesService } from './portal-sales.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal sales / growth tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads Shopify metrics only for session org + client', async () => {
    await portalSalesService.summary({ organizationId: ORG, customerId: CLIENT_A });
    expect(whereOf(db.shopifyDailyMetric.findMany)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.adAccount.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('loads GA4 website metrics only for session org + client', async () => {
    const summary = await portalSalesService.summary({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(ga4Service.website).toHaveBeenCalledWith(ORG, CLIENT_A);
    expect(ga4Service.website).not.toHaveBeenCalledWith(ORG, CLIENT_B);
    expect(summary.website).toEqual({
      connected: true,
      propertyName: 'Acme Web',
      sessions: 1200,
      users: 900,
      conversions: 20,
      days: 31,
      since: '2026-10-18',
      until: '2026-11-17',
    });
    expect(summary.shopify.connected).toBe(true);
  });

  it('never returns another client\'s GA4 when that client has no property', async () => {
    vi.mocked(ga4Service.website).mockResolvedValueOnce({ property: null, snapshot: null });
    const summary = await portalSalesService.summary({
      organizationId: ORG,
      customerId: CLIENT_B,
    });
    expect(ga4Service.website).toHaveBeenCalledWith(ORG, CLIENT_B);
    expect(summary.website).toBeNull();
  });

  it('client A GA4 metrics never leak to client B', async () => {
    const site = (
      displayName: string,
      totals: {
        sessions: number;
        totalUsers: number;
        newUsers: number;
        engagedSessions: number;
        addToCarts: number;
        checkouts: number;
        purchases: number;
        revenue: number;
        keyEvents: number;
      }
    ) => ({
      property: {
        propertyId: `props/${displayName}`,
        displayName,
        accountName: null,
        currency: 'INR',
        timeZone: 'Asia/Kolkata',
        status: 'active',
        lastError: null,
        lastSyncedAt: null,
      },
      snapshot: {
        periodStart: '2026-10-18',
        periodEnd: '2026-11-16',
        totals,
        channels: [],
        sources: [],
        landing: [],
        devices: [],
        updatedAt: '2026-11-17T00:00:00.000Z',
      },
    });
    vi.mocked(ga4Service.website).mockImplementation(async (_org, customerId) => {
      if (customerId === CLIENT_A) {
        return site('Site A', {
          sessions: 100,
          totalUsers: 80,
          newUsers: 40,
          engagedSessions: 60,
          addToCarts: 10,
          checkouts: 5,
          purchases: 3,
          revenue: 900,
          keyEvents: 3,
        });
      }
      return site('Site B', {
        sessions: 9999,
        totalUsers: 8888,
        newUsers: 1,
        engagedSessions: 1,
        addToCarts: 1,
        checkouts: 1,
        purchases: 77,
        revenue: 1,
        keyEvents: 77,
      });
    });

    const a = await portalSalesService.summary({ organizationId: ORG, customerId: CLIENT_A });
    const b = await portalSalesService.summary({ organizationId: ORG, customerId: CLIENT_B });

    expect(ga4Service.website).toHaveBeenCalledWith(ORG, CLIENT_A);
    expect(ga4Service.website).toHaveBeenCalledWith(ORG, CLIENT_B);
    expect(a.website).toMatchObject({
      propertyName: 'Site A',
      sessions: 100,
      conversions: 3,
    });
    expect(b.website).toMatchObject({
      propertyName: 'Site B',
      sessions: 9999,
      conversions: 77,
    });
    expect(a.website?.sessions).not.toBe(b.website?.sessions);
    expect(JSON.stringify(a)).not.toMatch(/Site B|9999|accessToken|refreshToken/);
  });

  it('scopes ad spend aggregation to this client\'s account ids only', async () => {
    db.adAccount.findMany.mockResolvedValueOnce([{ id: 'acc-a' }]);
    await portalSalesService.summary({ organizationId: ORG, customerId: CLIENT_A });
    expect(whereOf(db.adInsightDaily.groupBy)).toMatchObject({
      adAccountId: { in: ['acc-a'] },
      level: 'campaign',
    });
  });

  it('skips ad insights when this client has no ad accounts', async () => {
    db.adAccount.findMany.mockResolvedValueOnce([]);
    await portalSalesService.summary({ organizationId: ORG, customerId: CLIENT_A });
    expect(db.adInsightDaily.groupBy).not.toHaveBeenCalled();
  });
});
