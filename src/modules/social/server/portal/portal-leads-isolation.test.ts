import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
  });
  return { prisma: { socialLead: model() } };
});

import { prisma } from '@/shared/lib/prisma';
import { portalLeadsService } from './portal-leads.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal leads tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists leads only for session org + client', async () => {
    await portalLeadsService.list({ organizationId: ORG, customerId: CLIENT_A });
    expect(whereOf(db.socialLead.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('does not select payload or CRM fields', async () => {
    await portalLeadsService.list({ organizationId: ORG, customerId: CLIENT_A });
    const select = (db.socialLead.findMany.mock.calls[0]?.[0] as { select: Record<string, boolean> })
      .select;
    expect(select.payload).toBeUndefined();
    expect(select.crmExternalId).toBeUndefined();
    expect(select.assigneeId).toBeUndefined();
  });
});
