import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/env', () => ({ getServerEnv: () => ({ SHOPIFY_API_VERSION: '2026-07', ENCRYPTION_KEY: 'x'.repeat(32) }) }));
vi.mock('@/shared/server/client-scope', () => ({ getClientScope: vi.fn(), resolveSelectedClientId: vi.fn(), scopeFromAccess: vi.fn() }));
vi.mock('@/modules/social/server/ai/claude.client', () => ({ askAI: vi.fn() }));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
  });
  return {
    prisma: {
      socialCustomer: model(),
      socialTask: model(),
      socialBlog: model(),
      socialAdPlanItem: model(),
      socialChangeLog: model(),
      socialPost: model(),
      socialPostBoost: model(),
      socialBrief: model(),
      socialShopifyStore: model(),
      user: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { growthClientFromScope } from './growth-scope';
import { tasksService } from './tasks.service';
import { adPlanService, blogsService, briefsService, changeLogService, contentService } from './records.service';

const ORG = 'org-a';
const CLIENT = 'client-a';
type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('growth desk tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses the all-clients scope and checks the client belongs to the organization', async () => {
    await expect(growthClientFromScope({ organizationId: ORG, customerIds: 'all' })).rejects.toThrow(/Pick a client/);
    await expect(growthClientFromScope({ organizationId: ORG, customerIds: [CLIENT] })).rejects.toThrow(/Not found/);
    expect(whereOf(db.socialCustomer.findFirst)).toEqual({ id: CLIENT, organizationId: ORG, deletedAt: null });
  });

  it('task updates look the task up inside org + client', async () => {
    await expect(tasksService.update(ORG, CLIENT, 'task-of-other-client', { action: 'complete' }, 'u1', true)).rejects.toThrow(/Not found/);
    expect(whereOf(db.socialTask.findFirst)).toEqual({ id: 'task-of-other-client', organizationId: ORG, customerId: CLIENT });
  });

  it('reviewer-only task actions are refused for non-reviewers', async () => {
    db.socialTask.findFirst.mockResolvedValueOnce({ id: 't1', status: 'review' });
    await expect(tasksService.update(ORG, CLIENT, 't1', { action: 'approve' }, 'u1', false)).rejects.toThrow(/Only reviewers/);
  });

  it('blogs, ads, change log, briefs and boosts are all scoped', async () => {
    await expect(blogsService.get(ORG, CLIENT, 'b1')).rejects.toThrow(/Not found/);
    expect(whereOf(db.socialBlog.findFirst)).toEqual({ id: 'b1', organizationId: ORG, customerId: CLIENT });

    await expect(adPlanService.decide(ORG, CLIENT, 'a1', 'approved', null, 'u1')).rejects.toThrow(/Not found/);
    expect(whereOf(db.socialAdPlanItem.findFirst)).toEqual({ id: 'a1', organizationId: ORG, customerId: CLIENT });

    await expect(changeLogService.remove(ORG, CLIENT, 'c1')).rejects.toThrow(/Not found/);
    expect(whereOf(db.socialChangeLog.deleteMany)).toEqual({ id: 'c1', organizationId: ORG, customerId: CLIENT });

    await expect(briefsService.addTasks(ORG, CLIENT, 'br1', 'u1')).rejects.toThrow(/Not found/);
    expect(whereOf(db.socialBrief.findFirst)).toEqual({ id: 'br1', organizationId: ORG, customerId: CLIENT });

    await expect(contentService.setBoost(ORG, CLIENT, 'p1', { boost: true, budget: 500 })).rejects.toThrow(/Not found/);
    expect(whereOf(db.socialPost.findFirst)).toEqual({ id: 'p1', organizationId: ORG, customerId: CLIENT, deletedAt: null });
  });

  it('only approved blogs can be published, and never another client’s', async () => {
    db.socialBlog.findFirst.mockResolvedValueOnce({ id: 'b1', status: 'draft', bodyHtml: '<p>x</p>' });
    await expect(blogsService.publish(ORG, CLIENT, 'b1', 'Owner')).rejects.toThrow(/Approve the blog/);
  });
});
