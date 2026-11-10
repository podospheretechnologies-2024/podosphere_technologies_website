import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      id: 'req-1',
      type: 'post',
      title: 'Need a reel',
      detail: null,
      status: 'open',
      reply: null,
      createdAt: new Date('2026-11-10T00:00:00Z'),
      updatedAt: new Date('2026-11-10T00:00:00Z'),
    }),
    update: vi.fn().mockResolvedValue({
      id: 'req-1',
      type: 'post',
      title: 'Need a reel',
      detail: null,
      status: 'done',
      reply: 'Shipped',
      createdAt: new Date('2026-11-10T00:00:00Z'),
      updatedAt: new Date('2026-11-10T00:00:00Z'),
    }),
  });
  return {
    prisma: {
      socialPortalRequest: model(),
      socialCustomer: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalRequestsService } from './portal-requests.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

const session = {
  approverId: 'apr-a',
  organizationId: ORG,
  customerId: CLIENT_A,
  mustChangePassword: false,
};

describe('portal requests tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists requests only for session org + client', async () => {
    await portalRequestsService.listForPortal(session);
    expect(whereOf(db.socialPortalRequest.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('creates with session org, client, and approver — never from body', async () => {
    await portalRequestsService.createForPortal(session, {
      type: 'post',
      title: 'Need a reel',
    });
    expect(db.socialPortalRequest.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        organizationId: ORG,
        customerId: CLIENT_A,
        approverId: 'apr-a',
      },
    });
  });

  it('agency update looks up request inside org + client', async () => {
    db.socialPortalRequest.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalRequestsService.updateForAgency(ORG, CLIENT_A, 'req-of-b', { status: 'done' })
    ).rejects.toThrow(/Request not found/);
    expect(whereOf(db.socialPortalRequest.findFirst)).toEqual({
      id: 'req-of-b',
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('agency list refuses unknown client in this org', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce(null);
    await expect(portalRequestsService.listForAgency(ORG, CLIENT_B)).rejects.toThrow(/Client not found/);
    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_B,
      organizationId: ORG,
      deletedAt: null,
    });
  });
});
