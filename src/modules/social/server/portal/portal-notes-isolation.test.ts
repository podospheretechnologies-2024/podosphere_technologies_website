import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/env', () => ({
  getServerEnv: () => ({
    SESSION_SECRET: 'test-session-secret-at-least-32-chars!!',
    APP_URL: 'http://localhost:4000',
  }),
}));
vi.mock('@/shared/server/audit.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../notifications/notification.service', () => ({
  notificationService: { approvalNeeded: vi.fn() },
}));
vi.mock('../publishing/publish.queue', () => ({
  publishQueue: { schedule: vi.fn() },
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  });
  return { prisma: { socialPost: model(), clientApprover: model() } };
});

import { prisma } from '@/shared/lib/prisma';
import { approvalService } from '../approvals/approval.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';

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

describe('portal client notes tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only loads CLIENT-step drafts for session org + client', async () => {
    db.socialPost.findMany.mockResolvedValueOnce([]);
    await expect(approvalService.portalAddNote(session, 'group-b', 'Please revise')).rejects.toThrow(
      /not found/
    );
    expect(whereOf(db.socialPost.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
      group: 'group-b',
      deletedAt: null,
      state: 'DRAFT',
      approvalStep: 'CLIENT',
    });
  });

  it('writes the note onto the matched root post only', async () => {
    db.socialPost.findMany.mockResolvedValueOnce([
      {
        id: 'post-a',
        parentPostId: null,
        settings: {},
      },
    ]);
    await approvalService.portalAddNote(session, 'group-a', 'Swap the CTA');
    expect(db.socialPost.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'post-a' },
      data: {
        settings: {
          clientNotes: [{ text: 'Swap the CTA', approverId: 'apr-a' }],
        },
      },
    });
  });
});
