import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma', () => ({ prisma: {} }));

describe('parseFlexibleDate', () => {
  it('reads sheet date formats without a timezone shift', async () => {
    const { parseFlexibleDate } = await import('./google-sheets.service');
    expect(parseFlexibleDate('07-Oct-2026')).toBe('2026-10-07');
    expect(parseFlexibleDate('7 Oct 2026')).toBe('2026-10-07');
    expect(parseFlexibleDate('Wednesday, 07-Oct-2026')).toBe('2026-10-07');
    expect(parseFlexibleDate('Oct 7, 2026')).toBe('2026-10-07');
    expect(parseFlexibleDate('26 November 2026')).toBe('2026-11-26');
    expect(parseFlexibleDate('2026-11-26')).toBe('2026-11-26');
    expect(parseFlexibleDate('26/11/2026')).toBe('2026-11-26');
    expect(parseFlexibleDate('Week 1')).toBeNull();
  });
});

describe('parseFlexibleDate, Siyara sheet formats', () => {
  it('reads "01 Nov 2026, Sun" (Nov 26 tab) and "04-Oct-2026" (Content Calendar tab)', async () => {
    const { parseFlexibleDate } = await import('./google-sheets.service');
    expect(parseFlexibleDate('01 Nov 2026, Sun')).toBe('2026-11-01');
    expect(parseFlexibleDate('04-Oct-2026')).toBe('2026-10-04');
  });
});
