import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  });
  return { prisma: { socialCustomer: model() } };
});

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { portalGoalsService } from './portal-goals.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal goals tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads goals only for org + client', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce({ portalGoals: { leadsPerMonth: 100 } });
    const res = await portalGoalsService.get(ORG, CLIENT_A);
    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_A,
      organizationId: ORG,
      deletedAt: null,
    });
    expect(res.goals.leadsPerMonth).toBe(100);
  });

  it('refuses update for another client', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalGoalsService.update(ORG, CLIENT_B, { leadsPerMonth: 50 })
    ).rejects.toThrow(/Client not found/);
  });

  it('writes portalGoals only on the matching customer id', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce({ id: CLIENT_A, portalGoals: null });
    await portalGoalsService.update(ORG, CLIENT_A, { adBudgetPerMonth: 25000 });
    expect(db.socialCustomer.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: CLIENT_A },
      data: { portalGoals: { adBudgetPerMonth: 25000 } },
    });
    expect(Prisma.DbNull).toBeDefined();
  });
});
