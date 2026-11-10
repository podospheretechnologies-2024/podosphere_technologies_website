import { beforeEach, describe, expect, it, vi } from 'vitest';
import { breakdownRequest, parseAccountSummaries, parseBreakdownReport, parseDailyReport, parseTotalsReport } from './ga4.client';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/env', () => ({ getServerEnv: () => ({ APP_URL: 'https://app.test', ENCRYPTION_KEY: 'x'.repeat(32) }) }));
vi.mock('@/shared/lib/redis', () => ({ redis: { set: vi.fn(), getdel: vi.fn() } }));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  });
  return {
    prisma: {
      socialGa4Connection: model(),
      socialGa4Property: model(),
      ga4DailyMetric: model(),
      ga4TrafficSnapshot: model(),
      $transaction: vi.fn().mockResolvedValue([]),
    },
  };
});

describe('GA4 parsers', () => {
  it('lists only ordinary numeric properties with their account name', () => {
    const out = parseAccountSummaries({
      accountSummaries: [
        {
          displayName: 'Siyara',
          propertySummaries: [
            { property: 'properties/123', displayName: 'Siyara Store', propertyType: 'PROPERTY_TYPE_ORDINARY' },
            { property: 'properties/456', displayName: 'Roll-up', propertyType: 'PROPERTY_TYPE_ROLLUP' },
            { property: 'properties/789' },
          ],
        },
      ],
    });
    expect(out).toEqual([
      { propertyId: '123', displayName: 'Siyara Store', accountName: 'Siyara' },
      { propertyId: '789', displayName: '789', accountName: 'Siyara' },
    ]);
  });

  it('turns YYYYMMDD rows into sorted days and maps GA4 metric names', () => {
    const rows = parseDailyReport({
      dimensionHeaders: [{ name: 'date' }],
      metricHeaders: [{ name: 'sessions' }, { name: 'ecommercePurchases' }, { name: 'purchaseRevenue' }],
      rows: [
        { dimensionValues: [{ value: '20261102' }], metricValues: [{ value: '20' }, { value: '2' }, { value: '1999.456' }] },
        { dimensionValues: [{ value: '20261101' }], metricValues: [{ value: '10' }, { value: '0' }, { value: '0' }] },
        { dimensionValues: [{ value: '(other)' }], metricValues: [{ value: '5' }, { value: '0' }, { value: '0' }] },
      ],
    });
    expect(rows.map((r) => r.date)).toEqual(['2026-11-01', '2026-11-02']);
    expect(rows[1]).toMatchObject({ sessions: 20, purchases: 2, revenue: 1999.46, addToCarts: 0 });
  });

  it('reads totals from a report without dimensions, zero when empty', () => {
    expect(parseTotalsReport({ metricHeaders: [{ name: 'totalUsers' }], rows: [{ metricValues: [{ value: '42' }] }] }).totalUsers).toBe(42);
    expect(parseTotalsReport({}).sessions).toBe(0);
  });

  it('parses breakdown rows and labels empty dimensions', () => {
    const rows = parseBreakdownReport({
      metricHeaders: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'addToCarts' }, { name: 'ecommercePurchases' }, { name: 'purchaseRevenue' }],
      rows: [{ dimensionValues: [{ value: '' }], metricValues: [{ value: '9' }, { value: '7' }, { value: '3' }, { value: '1' }, { value: '500' }] }],
    });
    expect(rows).toEqual([{ name: '(not set)', sessions: 9, users: 7, atc: 3, purchases: 1, revenue: 500 }]);
  });

  it('builds a relative-date breakdown request', () => {
    const req = breakdownRequest('deviceCategory', 30, 5);
    expect(req.dateRanges).toEqual([{ startDate: '29daysAgo', endDate: 'today' }]);
    expect(req.limit).toBe(5);
  });
});

describe('GA4 property assignment isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a property that belongs to another client', async () => {
    const { prisma } = await import('@/shared/lib/prisma');
    const { ga4Service } = await import('./ga4.service');
    const find = prisma.socialGa4Property.findFirst as unknown as ReturnType<typeof vi.fn>;
    find.mockResolvedValueOnce(null); // client A has no property yet
    find.mockResolvedValueOnce({ id: 'row-1', organizationId: 'org', propertyId: '123', customerId: 'client-B' });
    await expect(ga4Service.assign('org', 'client-A', '123')).rejects.toMatchObject({ status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('drops synced rows when a property moves to a client', async () => {
    const { prisma } = await import('@/shared/lib/prisma');
    const { ga4Service } = await import('./ga4.service');
    const find = prisma.socialGa4Property.findFirst as unknown as ReturnType<typeof vi.fn>;
    find.mockResolvedValueOnce(null);
    find.mockResolvedValueOnce({ id: 'row-1', organizationId: 'org', propertyId: '123', customerId: null });
    await expect(ga4Service.assign('org', 'client-A', '123')).resolves.toBe('row-1');
    expect(prisma.ga4DailyMetric.deleteMany).toHaveBeenCalledWith({ where: { organizationId: 'org', propertyId: '123' } });
    expect(prisma.ga4TrafficSnapshot.deleteMany).toHaveBeenCalledWith({ where: { organizationId: 'org', propertyId: '123' } });
  });
});
