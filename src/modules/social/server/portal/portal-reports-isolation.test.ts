import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
  });
  return { prisma: { socialClientReport: model() } };
});

import { prisma } from '@/shared/lib/prisma';
import { portalReportsService } from './portal-reports.service';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal reports tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists reports only for session org + client', async () => {
    await portalReportsService.list({ organizationId: 'org-a', customerId: 'client-a' });
    expect(whereOf(db.socialClientReport.findMany)).toEqual({
      organizationId: 'org-a',
      customerId: 'client-a',
    });
  });

  it('download lookup refuses another client\'s report id', async () => {
    db.socialClientReport.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalReportsService.getForDownload(
        { organizationId: 'org-a', customerId: 'client-a' },
        'report-of-client-b'
      )
    ).rejects.toThrow(/Report not found/);
    expect(whereOf(db.socialClientReport.findFirst)).toEqual({
      id: 'report-of-client-b',
      organizationId: 'org-a',
      customerId: 'client-a',
    });
  });
});
