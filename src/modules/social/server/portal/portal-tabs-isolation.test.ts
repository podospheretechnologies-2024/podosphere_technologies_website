import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  });
  return {
    prisma: {
      socialCustomer: model(),
      socialIntegration: model(),
      adAccount: model(),
      socialGoogleAdsAccount: model(),
      socialShopifyStore: model(),
      socialWhatsAppConnection: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalTabsService } from './portal-tabs.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal tabs tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads flags only for the session org + client', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce({ portalTabs: null });
    await portalTabsService.getClientFlags(ORG, CLIENT_A);

    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_A,
      organizationId: ORG,
      deletedAt: null,
    });
    expect(whereOf(db.socialIntegration.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.adAccount.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialShopifyStore.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('refuses settings for another client id', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce(null);
    await expect(portalTabsService.getSettings(ORG, CLIENT_B)).rejects.toThrow(/Client not found/);
    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_B,
      organizationId: ORG,
      deletedAt: null,
    });
  });

  it('updates portalTabs only on the matching org + client row', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce({ id: CLIENT_A, portalTabs: null });
    db.socialCustomer.update.mockResolvedValueOnce({});
    // getSettings reload
    db.socialCustomer.findFirst.mockResolvedValueOnce({ portalTabs: { tabs: { ads: false } } });

    await portalTabsService.updateSettings(ORG, CLIENT_A, { tabs: { ads: false } });

    expect(db.socialCustomer.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: CLIENT_A },
      data: { portalTabs: { tabs: { ads: false } } },
    });
    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_A,
      organizationId: ORG,
      deletedAt: null,
    });
  });
});
