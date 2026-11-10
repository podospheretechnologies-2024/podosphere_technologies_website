import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: {} }),
  });
  return {
    prisma: {
      socialIntegration: model(),
      socialCustomer: model(),
      adAccount: model(),
      socialGoogleAdsAccount: model(),
      socialShopifyStore: model(),
      socialInsightDaily: model(),
      socialExternalPost: model(),
      adInsightDaily: model(),
      socialLead: model(),
      socialAdPlanItem: model(),
      socialPortalRequest: model(),
      shopifyDailyMetric: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalOverviewService } from './portal-overview.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal overview tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes channels, ads, leads, requests, and goals to session org + client', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce({
      portalTabs: null,
      portalGoals: { leadsPerMonth: 100 },
    });

    await portalOverviewService.get({ organizationId: ORG, customerId: CLIENT_A });

    expect(whereOf(db.socialIntegration.findMany)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_A,
      organizationId: ORG,
      deletedAt: null,
    });
    expect(whereOf(db.adAccount.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialLead.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialPortalRequest.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialAdPlanItem.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });
});
