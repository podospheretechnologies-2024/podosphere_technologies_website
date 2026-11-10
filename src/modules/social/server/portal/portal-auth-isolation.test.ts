import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/env', () => ({
  getServerEnv: () => ({
    SESSION_SECRET: 'test-session-secret-at-least-32-chars!!',
    APP_URL: 'http://localhost:4000',
    REDIS_URL: 'redis://127.0.0.1:6379',
  }),
}));
vi.mock('@/shared/lib/redis', () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  },
}));
vi.mock('@/shared/server/mailer', () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true, id: 'mail-1' }),
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  });
  return {
    prisma: {
      clientApprover: model(),
      socialCustomer: model(),
      organization: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalAuthService } from './portal-auth.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal auth tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists approvers only for the given org + client', async () => {
    await portalAuthService.listApprovers(ORG, CLIENT_A);
    expect(whereOf(db.clientApprover.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('refuses password actions for an approver on another client', async () => {
    db.clientApprover.findFirst.mockResolvedValueOnce(null);
    await expect(portalAuthService.generatePassword(ORG, CLIENT_A, 'approver-of-b')).rejects.toThrow(
      /Portal login not found/
    );
    expect(whereOf(db.clientApprover.findFirst)).toEqual({
      id: 'approver-of-b',
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('changePassword looks up the session approver inside org + client only', async () => {
    db.clientApprover.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalAuthService.changePassword(
        {
          approverId: 'approver-of-b',
          organizationId: ORG,
          customerId: CLIENT_A,
          mustChangePassword: false,
        },
        { password: 'newpassword1', passwordConfirmation: 'newpassword1', currentPassword: 'old' }
      )
    ).rejects.toThrow(/Please sign in again/);

    expect(whereOf(db.clientApprover.findFirst)).toEqual({
      id: 'approver-of-b',
      organizationId: ORG,
      customerId: CLIENT_A,
      disabledAt: null,
    });
  });

  it('createApprover verifies the client belongs to the organization', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalAuthService.createApprover(ORG, CLIENT_B, {
        email: 'owner@client-b.test',
        name: 'Owner',
        phone: undefined,
      })
    ).rejects.toThrow(/Client not found/);
    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_B,
      organizationId: ORG,
      deletedAt: null,
    });
  });

  it('disable looks the approver up inside org + client', async () => {
    db.clientApprover.findFirst.mockResolvedValueOnce(null);
    await expect(portalAuthService.setDisabled(ORG, CLIENT_A, 'approver-of-b', true)).rejects.toThrow(
      /Portal login not found/
    );
    expect(whereOf(db.clientApprover.findFirst)).toEqual({
      id: 'approver-of-b',
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });
});
