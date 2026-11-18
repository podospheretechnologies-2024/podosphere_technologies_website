import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
  });
  return {
    prisma: {
      socialWhatsAppAutoReply: model(),
      socialAutoPost: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalPlugsService } from './portal-plugs.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal plugs tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists auto-replies and auto-posts only for session org + client', async () => {
    await portalPlugsService.list({ organizationId: ORG, customerId: CLIENT_A });

    expect(whereOf(db.socialWhatsAppAutoReply.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
      deletedAt: null,
    });
    expect(whereOf(db.socialAutoPost.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
      deletedAt: null,
    });
  });

  it('does not select secrets or internal channel ids', async () => {
    await portalPlugsService.list({ organizationId: ORG, customerId: CLIENT_A });

    const autoSelect = (
      db.socialWhatsAppAutoReply.findMany.mock.calls[0]?.[0] as {
        select: Record<string, boolean>;
      }
    ).select;
    expect(autoSelect.templateVariables).toBeUndefined();

    const postSelect = (
      db.socialAutoPost.findMany.mock.calls[0]?.[0] as {
        select: Record<string, boolean>;
      }
    ).select;
    expect(postSelect.url).toBeUndefined();
    expect(postSelect.lastUrl).toBeUndefined();
    expect(postSelect.integrationIds).toBeUndefined();
    expect(postSelect.content).toBeUndefined();
  });
});
