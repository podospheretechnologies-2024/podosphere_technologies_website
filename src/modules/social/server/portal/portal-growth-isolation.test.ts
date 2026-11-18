import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./portal-sales.service', () => ({
  portalSalesService: {
    summary: vi.fn().mockResolvedValue({
      shopify: {
        connected: true,
        shopName: 'Demo',
        currency: 'INR',
        since: '2026-10-19',
        until: '2026-11-17',
        showSpend: true,
        totals: { orders: 10, sales: 1000, spend: 100, roas: 10, aov: 100 },
        days: [],
      },
      website: {
        connected: true,
        propertyName: 'Acme',
        sessions: 50,
        users: 40,
        conversions: 2,
        days: 30,
        since: '2026-10-19',
        until: '2026-11-17',
      },
    }),
  },
}));
vi.mock('./portal-tabs.service', () => ({
  portalTabsService: {
    getClientFlags: vi.fn().mockResolvedValue({
      hasChannels: false,
      hasAds: true,
      hasShopify: true,
      hasLeadSources: false,
      hasWhatsApp: false,
      portalTabs: { adSpendVisible: true },
    }),
  },
}));
vi.mock('../growth/growth.service', () => ({
  getSettings: vi.fn().mockResolvedValue({
    targetRoas: 10,
    targetCpl: null,
    dailyBudget: null,
    budgetCap: null,
    blogsPerMonth: 5,
    reportEveryDays: 15,
    contentSheetUrl: null,
    brandContext: null,
    insightsEnabled: true,
    lastInsightsAt: null,
  }),
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    groupBy: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
  });
  return {
    prisma: {
      adAccount: model(),
      adInsightDaily: model(),
      adEntity: model(),
      socialPost: model(),
      socialAdPlanItem: model(),
      socialBlog: model(),
      socialGrowthReport: model(),
      socialBrief: model(),
      socialClientReport: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { getSettings } from '../growth/growth.service';
import { portalGrowthService } from './portal-growth.service';
import { portalGrowthContentService } from './portal-growth-content.service';
import { portalGrowthReportsService } from './portal-growth-reports.service';
import { portalGrowthCampaignsService } from './portal-growth-campaigns.service';
import { portalGrowthBlogsService } from './portal-growth-blogs.service';
import { portalGrowthIdeasService, PORTAL_IDEA_AREA } from './portal-growth-ideas.service';
import { portalSalesService } from './portal-sales.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';
const APPROVER = 'ap-a';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

const sessionA = {
  approverId: APPROVER,
  organizationId: ORG,
  customerId: CLIENT_A,
  mustChangePassword: false,
};

describe('portal growth overview isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes settings, posts, ads, and blogs to session org + client', async () => {
    await portalGrowthService.overview({ organizationId: ORG, customerId: CLIENT_A });
    expect(portalSalesService.summary).toHaveBeenCalledWith(
      { organizationId: ORG, customerId: CLIENT_A },
      expect.any(Object)
    );
    expect(getSettings).toHaveBeenCalledWith(ORG, CLIENT_A);
    expect(whereOf(db.adAccount.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialPost.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialAdPlanItem.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialBlog.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('does not query client B when loading client A', async () => {
    await portalGrowthService.overview({ organizationId: ORG, customerId: CLIENT_A });
    expect(getSettings).not.toHaveBeenCalledWith(ORG, CLIENT_B);
    expect(JSON.stringify(db.adAccount.findMany.mock.calls)).not.toContain(CLIENT_B);
  });
});

describe('portal growth content isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists posts only for session org + client', async () => {
    await portalGrowthContentService.summary({ organizationId: ORG, customerId: CLIENT_A });
    expect(whereOf(db.socialPost.findMany)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
      deletedAt: null,
      parentPostId: null,
    });
  });
});

describe('portal growth reports isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists growth reports only for session org + client', async () => {
    await portalGrowthReportsService.list({ organizationId: ORG, customerId: CLIENT_A });
    expect(whereOf(db.socialGrowthReport.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('refuses another client growth report id', async () => {
    db.socialGrowthReport.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalGrowthReportsService.getGrowthSummary(
        { organizationId: ORG, customerId: CLIENT_A },
        'report-b'
      )
    ).rejects.toThrow(/not found/i);
    expect(whereOf(db.socialGrowthReport.findFirst)).toMatchObject({
      id: 'report-b',
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });
});

describe('portal growth campaigns isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('decide looks up the ad plan only for session org + client', async () => {
    db.socialAdPlanItem.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalGrowthCampaignsService.decide(sessionA, 'ad-b', 'approved')
    ).rejects.toThrow(/not found/i);
    expect(whereOf(db.socialAdPlanItem.findFirst)).toEqual({
      id: 'ad-b',
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });
});

describe('portal growth blogs isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('decide looks up the blog only for session org + client', async () => {
    db.socialBlog.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalGrowthBlogsService.decide(sessionA, 'blog-b', 'approve')
    ).rejects.toThrow(/not found/i);
    expect(whereOf(db.socialBlog.findFirst)).toEqual({
      id: 'blog-b',
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });
});

describe('portal growth ideas isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists ideas only for session org + client', async () => {
    await portalGrowthIdeasService.list(sessionA);
    expect(whereOf(db.socialBrief.findMany)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('creates idea with session org, client, and approver — never body clientId', async () => {
    db.socialBrief.create.mockResolvedValueOnce({
      id: 'idea-1',
      area: PORTAL_IDEA_AREA,
      ask: 'Try a reel about SPF',
      createdAt: new Date('2026-11-18T00:00:00Z'),
    });
    const idea = await portalGrowthIdeasService.create(sessionA, { ask: 'Try a reel about SPF' });
    expect(db.socialBrief.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG,
          customerId: CLIENT_A,
          createdById: APPROVER,
          area: PORTAL_IDEA_AREA,
          ask: 'Try a reel about SPF',
        }),
      })
    );
    expect(idea.ask).toBe('Try a reel about SPF');
    expect(JSON.stringify(db.socialBrief.create.mock.calls)).not.toContain(CLIENT_B);
  });
});
