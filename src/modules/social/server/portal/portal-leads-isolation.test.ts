import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/server/audit.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({
      id: 'lead-a',
      source: 'whatsapp',
      name: 'Ada',
      email: null,
      phone: '999',
      stage: 'contacted',
      score: 50,
      createdAt: new Date('2026-11-10T00:00:00Z'),
    }),
  });
  return { prisma: { socialLead: model() } };
});

import { prisma } from '@/shared/lib/prisma';
import { logAudit } from '@/shared/server/audit.service';
import { portalLeadsService } from './portal-leads.service';

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

  it('updateStage looks up lead inside session org + client only', async () => {
    db.socialLead.findFirst.mockResolvedValueOnce(null);
    await expect(portalLeadsService.updateStage(sessionA, 'lead-of-b', 'qualified')).rejects.toThrow(
      /Lead not found/
    );
    expect(whereOf(db.socialLead.findFirst)).toEqual({
      id: 'lead-of-b',
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(db.socialLead.update).not.toHaveBeenCalled();
  });

  it('updateStage refuses to write when lead belongs to another client', async () => {
    const sessionB = { ...sessionA, customerId: CLIENT_B, approverId: 'apr-b' };
    db.socialLead.findFirst.mockResolvedValueOnce(null);
    await expect(portalLeadsService.updateStage(sessionB, 'lead-a', 'won')).rejects.toThrow(
      /Lead not found/
    );
    expect(whereOf(db.socialLead.findFirst)).toEqual({
      id: 'lead-a',
      organizationId: ORG,
      customerId: CLIENT_B,
    });
  });

  it('updateStage writes only after org + client match and audits with approverId', async () => {
    db.socialLead.findFirst.mockResolvedValueOnce({
      id: 'lead-a',
      name: 'Ada',
      email: null,
      phone: '999',
      payload: {},
      stage: 'new',
    });
    const lead = await portalLeadsService.updateStage(sessionA, 'lead-a', 'contacted');
    expect(lead.stage).toBe('contacted');
    expect(db.socialLead.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'lead-a' },
      data: { stage: 'contacted' },
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'portal.lead_stage',
        targetId: 'lead-a',
        metadata: expect.objectContaining({
          customerId: CLIENT_A,
          approverId: 'apr-a',
          to: 'contacted',
        }),
      })
    );
  });
});
