import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/env', () => ({
  getServerEnv: () => ({ APP_URL: 'http://localhost:4000' }),
}));
vi.mock('@/shared/server/mailer', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue({ ok: true, id: '1' }),
}));
vi.mock('../whatsapp/whatsapp.service', () => ({
  whatsappService: { send: vi.fn().mockResolvedValue({ messageId: 'wamid', waId: null }) },
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
  });
  return {
    prisma: {
      clientApprover: model(),
      socialCustomer: model(),
      socialPost: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { sendNotificationEmail } from '@/shared/server/mailer';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { portalApprovalAlertService } from './portal-approval-alert.service';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal approval alert tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads approvers and waiting posts only for the given org + client', async () => {
    db.clientApprover.findMany.mockResolvedValueOnce([
      { email: 'a@client.test', name: 'A', phone: '919999999999' },
    ]);
    db.socialCustomer.findFirst.mockResolvedValueOnce({ name: 'Client A' });
    db.socialPost.count.mockResolvedValueOnce(2);

    await portalApprovalAlertService.notifyClientApprovalNeeded('org-a', 'client-a', 'group-1');

    expect(whereOf(db.clientApprover.findMany)).toEqual({
      organizationId: 'org-a',
      customerId: 'client-a',
      disabledAt: null,
    });
    expect(whereOf(db.socialPost.count)).toMatchObject({
      organizationId: 'org-a',
      customerId: 'client-a',
      approvalStep: 'CLIENT',
    });
    expect(sendNotificationEmail).toHaveBeenCalled();
    expect(whatsappService.send).toHaveBeenCalledWith(
      { organizationId: 'org-a', customerIds: ['client-a'] },
      expect.objectContaining({ type: 'text', to: '919999999999' })
    );
  });

  it('does nothing when the client has no portal logins', async () => {
    await portalApprovalAlertService.notifyClientApprovalNeeded('org-a', 'client-b', 'group-1');
    expect(sendNotificationEmail).not.toHaveBeenCalled();
    expect(whatsappService.send).not.toHaveBeenCalled();
  });
});
