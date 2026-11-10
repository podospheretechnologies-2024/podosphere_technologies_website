import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../approvals/approval.service', () => ({
  approvalService: { listPortalQueue: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
  });
  return {
    prisma: {
      socialIntegration: model(),
      socialPost: model(),
      socialExternalPost: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalContentService } from './portal-content.service';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

const session = {
  approverId: 'ap-1',
  organizationId: 'org-a',
  customerId: 'client-a',
  mustChangePassword: false,
};

describe('portal content tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists planned posts only for session org + client', async () => {
    await portalContentService.get(session);
    expect(whereOf(db.socialIntegration.findMany)).toEqual({
      organizationId: 'org-a',
      customerId: 'client-a',
      deletedAt: null,
    });
    expect(whereOf(db.socialPost.findMany)).toMatchObject({
      organizationId: 'org-a',
      customerId: 'client-a',
      deletedAt: null,
      parentPostId: null,
    });
  });
});
