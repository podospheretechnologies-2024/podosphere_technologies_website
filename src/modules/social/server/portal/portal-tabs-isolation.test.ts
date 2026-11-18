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
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  });
  return {
    prisma: {
      socialCustomer: model(),
      socialIntegration: model(),
      adAccount: model(),
      socialGoogleAdsAccount: model(),
      socialShopifyStore: model(),
      socialWhatsAppConnection: model(),
      organization: model(),
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

    await portalTabsService.updateSettings(ORG, CLIENT_A, { tabs: { ads: 'off' } });

    expect(db.socialCustomer.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: CLIENT_A },
      data: { portalTabs: { tabs: { ads: 'off' } } },
    });
    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_A,
      organizationId: ORG,
      deletedAt: null,
    });
  });

  it('copies settings only inside the same org, never onto the source', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce({
      portalTabs: { tabs: { ads: 'view' }, order: ['reports', 'overview'] },
    });
    db.socialCustomer.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await portalTabsService.copySettings(ORG, CLIENT_A, [CLIENT_A, CLIENT_B]);

    expect(result).toEqual({ updated: 1 });
    expect(db.socialCustomer.updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: { in: [CLIENT_B] }, organizationId: ORG, deletedAt: null },
      data: { portalTabs: { tabs: { ads: 'view' }, order: ['reports', 'overview'] } },
    });
  });

  it('reads and saves org portal defaults only for that organization', async () => {
    db.organization.findFirst.mockResolvedValueOnce({
      portalTabDefaults: { tabs: { ads: 'view' }, adSpendVisible: false },
    });
    const loaded = await portalTabsService.getOrgDefaults(ORG);
    expect(loaded.exists).toBe(true);
    expect(loaded.config).toMatchObject({ tabs: { ads: 'view' }, adSpendVisible: false });
    expect(whereOf(db.organization.findFirst)).toEqual({ id: ORG, deletedAt: null });

    db.organization.findFirst.mockResolvedValueOnce({ id: ORG });
    db.organization.update.mockResolvedValueOnce({});
    db.organization.findFirst.mockResolvedValueOnce({
      portalTabDefaults: { tabs: { inbox: 'act' }, order: ['overview', 'inbox'] },
    });

    const saved = await portalTabsService.saveOrgDefaults(ORG, {
      tabs: { inbox: 'act' },
      order: ['overview', 'inbox'],
    });
    expect(db.organization.update.mock.calls[0]?.[0]).toEqual({
      where: { id: ORG },
      data: { portalTabDefaults: { tabs: { inbox: 'act' }, order: ['overview', 'inbox'] } },
    });
    expect(saved.exists).toBe(true);
  });

  it('copies a client portalTabs into org defaults without touching other orgs', async () => {
    const ORG_B = 'org-b';
    db.socialCustomer.findFirst.mockResolvedValueOnce({
      portalTabs: { tabs: { agent: 'off' }, whatsappDailyCap: 20 },
    });
    db.organization.findFirst.mockResolvedValueOnce({ id: ORG });
    db.organization.update.mockResolvedValueOnce({});
    db.organization.findFirst.mockResolvedValueOnce({
      portalTabDefaults: { tabs: { agent: 'off' }, whatsappDailyCap: 20 },
    });

    await portalTabsService.saveClientAsOrgDefaults(ORG, CLIENT_A);

    expect(whereOf(db.socialCustomer.findFirst)).toEqual({
      id: CLIENT_A,
      organizationId: ORG,
      deletedAt: null,
    });
    expect(db.organization.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ORG },
      data: { portalTabDefaults: { tabs: { agent: 'off' }, whatsappDailyCap: 20 } },
    });
    expect(db.organization.update.mock.calls[0]?.[0].where.id).not.toBe(ORG_B);
  });

  it('refuses saveClientAsOrgDefaults when the client is not in the org', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce(null);
    await expect(portalTabsService.saveClientAsOrgDefaults(ORG, CLIENT_B)).rejects.toThrow(
      /Client not found/
    );
    expect(db.organization.update).not.toHaveBeenCalled();
  });
});

describe('portal tab access levels', () => {
  beforeEach(() => vi.resetAllMocks());

  function storedTabs(portalTabs: unknown) {
    db.socialCustomer.findFirst.mockResolvedValue({ portalTabs });
    for (const model of ['socialIntegration', 'adAccount', 'socialGoogleAdsAccount', 'socialShopifyStore', 'socialWhatsAppConnection']) {
      db[model]!.count!.mockResolvedValue(0);
    }
  }

  it('blocks a change when the agency set the tab to view only', async () => {
    storedTabs({ tabs: { requests: 'view' } });
    await expect(
      portalTabsService.requireLevel(ORG, CLIENT_A, 'requests', 'view')
    ).resolves.toBeUndefined();
    await expect(portalTabsService.requireLevel(ORG, CLIENT_A, 'requests', 'act')).rejects.toThrow(
      /only view/
    );
  });

  it('blocks reads of a hidden tab', async () => {
    storedTabs({ tabs: { reports: 'off' } });
    await expect(portalTabsService.requireLevel(ORG, CLIENT_A, 'reports', 'view')).rejects.toThrow(
      /not switched on/
    );
  });

  it('keeps old true/false rows working and never lets a read-only tab act', async () => {
    storedTabs({ tabs: { content: true, brand: false, ads: 'act' } });
    const settings = await portalTabsService.getSettings(ORG, CLIENT_A);
    expect(settings.levels.content).toBe('act');
    expect(settings.levels.brand).toBe('off');
    expect(settings.levels.ads).toBe('view');
    // Untouched tabs keep what clients could already do.
    expect(settings.levels.requests).toBe('act');
    expect(settings.levels.sales).toBe('off');
  });

  it('puts the agency order first and drops hidden tabs from the menu', async () => {
    storedTabs({ tabs: { analytics: 'off' }, order: ['reports', 'overview'] });
    const tabs = await portalTabsService.listEnabledTabs(ORG, CLIENT_A);
    expect(tabs.map((tab) => tab.id)).toEqual([
      'reports',
      'overview',
      'content',
      'brand',
      'channels',
      'requests',
    ]);
  });
});
