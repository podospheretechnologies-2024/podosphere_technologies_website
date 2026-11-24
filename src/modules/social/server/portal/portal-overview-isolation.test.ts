import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue({ timeZone: 'Asia/Kolkata' }),
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
      socialPost: model(),
      socialInboxThread: model(),
      organization: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalOverviewService } from './portal-overview.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>, callIndex = 0) {
  return (fn.mock.calls[callIndex]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal overview tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes channels, posts, inbox, ads, leads, requests, and goals to session org + client', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce({
      portalTabs: null,
      portalGoals: { leadsPerMonth: 100 },
    });

    const dto = await portalOverviewService.get({ organizationId: ORG, customerId: CLIENT_A });

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
      isAgencyAccount: false,
    });

    expect(whereOf(db.socialPost.count, 0)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
      state: 'QUEUE',
    });
    expect(whereOf(db.socialPost.count, 1)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
      state: 'DRAFT',
      approvalStep: 'CLIENT',
    });

    expect(whereOf(db.socialInboxThread.count)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
      lastDirection: 'inbound',
      closedAt: null,
      hiddenAt: null,
    });

    expect(whereOf(db.socialLead.count, 0)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialLead.count, 1)).toMatchObject({
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

    expect(dto.stats.map((s) => s.id)).toEqual([
      'postsDue',
      'waitingApproval',
      'leads',
      'inboxWaiting',
      'spend30d',
      'followers',
    ]);
  });

  it('omits ad spend tile when portalTabs.adSpendVisible is false', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce({
      portalTabs: { adSpendVisible: false },
      portalGoals: null,
    });

    const dto = await portalOverviewService.get({ organizationId: ORG, customerId: CLIENT_A });

    expect(dto.stats.map((s) => s.id)).toEqual([
      'postsDue',
      'waitingApproval',
      'leads',
      'inboxWaiting',
      'followers',
    ]);
    expect(dto.stats.some((s) => s.id === 'spend30d')).toBe(false);
  });
});
