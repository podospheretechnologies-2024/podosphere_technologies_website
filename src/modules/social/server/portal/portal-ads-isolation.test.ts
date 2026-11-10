import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../google-ads/google-ads.service', () => ({
  googleAdsService: { overview: vi.fn().mockRejectedValue(new Error('skip')) },
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    aggregate: vi.fn().mockResolvedValue({ _sum: {} }),
    groupBy: vi.fn().mockResolvedValue([]),
  });
  return {
    prisma: {
      socialCustomer: model(),
      adAccount: model(),
      socialGoogleAdsAccount: model(),
      adInsightDaily: model(),
      adEntity: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalAdsService } from './portal-ads.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal ads tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads Meta and Google ad accounts only for session org + client', async () => {
    await portalAdsService.summary({ organizationId: ORG, customerId: CLIENT_A });

    expect(whereOf(db.adAccount.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialGoogleAdsAccount.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('never queries insights until accounts are scoped to this client', async () => {
    db.adAccount.findMany.mockResolvedValueOnce([]);
    await portalAdsService.summary({ organizationId: ORG, customerId: CLIENT_A });
    expect(db.adInsightDaily.aggregate).not.toHaveBeenCalled();
    expect(db.adInsightDaily.groupBy).not.toHaveBeenCalled();
  });

  it('aggregates insights only for this client\'s ad account ids', async () => {
    db.adAccount.findMany.mockResolvedValueOnce([
      { id: 'acc-a', name: 'Brand Meta', currency: 'INR' },
    ]);
    db.adInsightDaily.aggregate.mockResolvedValueOnce({
      _sum: { spend: 100, impressions: BigInt(1000), clicks: 50, leads: 5, purchases: 1 },
    });
    db.adInsightDaily.groupBy.mockResolvedValueOnce([]);

    await portalAdsService.summary({ organizationId: ORG, customerId: CLIENT_A });

    expect(whereOf(db.adInsightDaily.aggregate)).toMatchObject({
      adAccountId: { in: ['acc-a'] },
      level: 'campaign',
    });
  });
});
