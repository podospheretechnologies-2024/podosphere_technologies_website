import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue([]),
  });
  return {
    prisma: {
      socialIntegration: model(),
      socialInsightDaily: model(),
      socialExternalPost: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalAnalyticsService } from './portal-analytics.service';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal analytics tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes channels to session org + client', async () => {
    await portalAnalyticsService.get({ organizationId: 'org-a', customerId: 'client-a' });
    expect(whereOf(db.socialIntegration.findMany)).toEqual({
      organizationId: 'org-a',
      customerId: 'client-a',
      deletedAt: null,
    });
  });

  it('does not query posts until channels are scoped', async () => {
    db.socialIntegration.findMany.mockResolvedValueOnce([]);
    await portalAnalyticsService.get({ organizationId: 'org-a', customerId: 'client-a' });
    expect(db.socialExternalPost.findMany).not.toHaveBeenCalled();
  });
});
