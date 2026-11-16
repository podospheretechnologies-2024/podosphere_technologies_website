import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { sentCount: 0 } }),
  });
  return {
    prisma: {
      socialWhatsAppConnection: model(),
      socialLead: model(),
      whatsAppBroadcast: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { portalWhatsAppService } from './portal-whatsapp.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal WhatsApp tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes connections, leads and broadcasts to session org + client', async () => {
    await portalWhatsAppService.summary({ organizationId: ORG, customerId: CLIENT_A });
    expect(whereOf(db.socialWhatsAppConnection.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialLead.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.whatsAppBroadcast.aggregate)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
      status: { in: ['sent', 'partial'] },
    });
  });
});
