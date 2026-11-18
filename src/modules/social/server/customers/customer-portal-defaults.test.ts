import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const tx = {
  organization: {
    findFirst: vi.fn(),
  },
  socialCustomer: {
    create: vi.fn(),
  },
  clientApprover: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  socialIntegration: { updateMany: vi.fn() },
  adAccount: { updateMany: vi.fn() },
  socialGoogleAdsAccount: { updateMany: vi.fn() },
};

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    organization: { findFirst: vi.fn(), findUnique: vi.fn() },
    socialCustomer: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    socialIntegration: { updateMany: vi.fn() },
    adAccount: { updateMany: vi.fn() },
    socialGoogleAdsAccount: { updateMany: vi.fn() },
  },
}));

vi.mock('../billing/plan.service', () => ({
  planService: {
    assertClientCapacity: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ maxClients: 10, label: 'Starter' }),
  },
}));

import { customerService } from './customer.service';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

describe('createClient copies org portalTabDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.clientApprover.findFirst.mockResolvedValue(null);
    tx.clientApprover.create.mockResolvedValue({ id: 'approver-1' });
    tx.socialCustomer.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'client-new',
      ...data,
    }));
  });

  it('copies Organization.portalTabDefaults onto the new SocialCustomer', async () => {
    const defaults = {
      tabs: { ads: 'view', agent: 'off' },
      order: ['overview', 'ads'],
      adSpendVisible: false,
      whatsappDailyCap: 25,
    };
    tx.organization.findFirst.mockResolvedValueOnce({ portalTabDefaults: defaults });

    await customerService.createClient(ORG_A, {
      name: 'Acme',
      approverName: 'Pat',
      approverEmail: 'pat@acme.test',
    });

    expect(tx.organization.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ORG_A },
      select: { portalTabDefaults: true },
    });
    expect(tx.socialCustomer.create.mock.calls[0]?.[0].data).toMatchObject({
      organizationId: ORG_A,
      name: 'Acme',
      portalTabs: defaults,
    });
  });

  it('leaves portalTabs unset when the org has no default', async () => {
    tx.organization.findFirst.mockResolvedValueOnce({ portalTabDefaults: null });

    await customerService.createClient(ORG_A, {
      name: 'Blank',
      approverName: 'Sam',
      approverEmail: 'sam@blank.test',
    });

    const data = tx.socialCustomer.create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data.portalTabs).toBeUndefined();
  });

  it('never applies org A defaults when creating a client in org B', async () => {
    const orgADefaults = { tabs: { inbox: 'act' }, adSpendVisible: false };
    tx.organization.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === ORG_A) return { portalTabDefaults: orgADefaults };
      if (where.id === ORG_B) return { portalTabDefaults: null };
      return null;
    });

    await customerService.createClient(ORG_B, {
      name: 'Other Org Client',
      approverName: 'Lee',
      approverEmail: 'lee@other.test',
    });

    expect(tx.organization.findFirst.mock.calls[0]?.[0].where).toEqual({ id: ORG_B });
    const data = tx.socialCustomer.create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data.organizationId).toBe(ORG_B);
    expect(data.portalTabs).toBeUndefined();
    expect(data.portalTabs).not.toEqual(orgADefaults);
  });
});
