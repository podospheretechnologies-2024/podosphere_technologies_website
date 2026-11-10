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
vi.mock('./portal-tabs.service', () => ({
  portalTabsService: {
    getClientFlags: vi.fn().mockResolvedValue({
      hasChannels: false,
      hasAds: true,
      hasShopify: true,
      hasLeadSources: true,
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
import { portalSalesService } from './portal-sales.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal sales tenant isolation', () => {
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
