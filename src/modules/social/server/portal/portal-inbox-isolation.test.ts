import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/server/audit.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../inbox/inbox.service', () => ({
  inboxService: {
    reply: vi.fn().mockResolvedValue({
      id: 'thread-a',
      platform: 'instagram',
      kind: 'dm',
      contactName: 'Alex',
      lastPreview: 'Thanks',
      lastMessageAt: '2026-11-17T10:00:00.000Z',
      firstResponseAt: '2026-11-17T10:00:00.000Z',
      hiddenAt: null,
      message: {
        id: 'msg-out',
        direction: 'outbound',
        body: 'Thanks',
        createdAt: '2026-11-17T10:00:00.000Z',
      },
    }),
  },
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
  });
  return {
    prisma: {
      socialIntegration: model(),
      socialInboxThread: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { logAudit } from '@/shared/server/audit.service';
import { inboxService } from '../inbox/inbox.service';
import { portalInboxService } from './portal-inbox.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

const sessionA = {
  approverId: 'apr-a',
  organizationId: ORG,
  customerId: CLIENT_A,
  mustChangePassword: false,
};

describe('portal inbox tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists threads only for session org + client (direct or channel join)', async () => {
    db.socialIntegration.findMany.mockResolvedValueOnce([{ internalId: 'page-a' }]);
    await portalInboxService.listThreads({ organizationId: ORG, customerId: CLIENT_A });

    expect(whereOf(db.socialIntegration.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
      deletedAt: null,
    });
    expect(whereOf(db.socialInboxThread.findMany)).toEqual({
      organizationId: ORG,
      OR: [{ customerId: CLIENT_A }, { channelInternalId: { in: ['page-a'] }, customerId: null }],
    });
  });

  it('does not select assignee, AI draft, or external ids on list', async () => {
    db.socialIntegration.findMany.mockResolvedValueOnce([]);
    await portalInboxService.listThreads({ organizationId: ORG, customerId: CLIENT_A });
    const select = (
      db.socialInboxThread.findMany.mock.calls[0]?.[0] as { select: Record<string, unknown> }
    ).select;
    expect(select.assigneeId).toBeUndefined();
    expect(select.aiDraft).toBeUndefined();
    expect(select.externalId).toBeUndefined();
    expect(select.channelInternalId).toBeUndefined();
  });

  it('loads thread detail only inside portal where (org + client)', async () => {
    db.socialIntegration.findMany.mockResolvedValueOnce([]);
    db.socialInboxThread.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalInboxService.getThread({ organizationId: ORG, customerId: CLIENT_A }, 'thread-b')
    ).rejects.toThrow(/not found/i);

    expect(whereOf(db.socialInboxThread.findFirst)).toMatchObject({
      id: 'thread-b',
      organizationId: ORG,
      OR: [{ customerId: CLIENT_A }],
    });
  });

  it('replies with forced client scope and audits approverId', async () => {
    db.socialIntegration.findMany.mockResolvedValue([{ internalId: 'page-a' }]);
    db.socialInboxThread.findFirst.mockResolvedValueOnce({
      id: 'thread-a',
      platform: 'instagram',
      kind: 'dm',
      contactName: 'Alex',
      lastPreview: 'Hi',
      lastMessageAt: new Date('2026-11-17T09:00:00.000Z'),
      messages: [],
    });

    await portalInboxService.reply(sessionA, 'thread-a', 'Thanks');

    expect(inboxService.reply).toHaveBeenCalledWith(
      { organizationId: ORG, customerIds: [CLIENT_A] },
      'thread-a',
      'Thanks'
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'portal.inbox.reply',
        targetType: 'inbox_thread',
        targetId: 'thread-a',
        metadata: expect.objectContaining({
          customerId: CLIENT_A,
          approverId: 'apr-a',
        }),
      })
    );
  });

  it('never uses another client id when building scope for reply', async () => {
    db.socialIntegration.findMany.mockResolvedValue([{ internalId: 'page-a' }]);
    db.socialInboxThread.findFirst.mockResolvedValueOnce({
      id: 'thread-a',
      platform: 'facebook',
      kind: 'comment',
      contactName: null,
      lastPreview: 'Ok',
      lastMessageAt: new Date(),
      messages: [],
    });

    await portalInboxService.reply(sessionA, 'thread-a', 'Noted');
    const scope = (inboxService.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      customerIds: string[];
    };
    expect(scope.customerIds).toEqual([CLIENT_A]);
    expect(scope.customerIds).not.toContain(CLIENT_B);
  });
});
