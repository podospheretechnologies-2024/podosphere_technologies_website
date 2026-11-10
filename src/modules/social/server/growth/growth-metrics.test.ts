import { describe, expect, it } from 'vitest';
import {
  bucketOrders,
  daysBetween,
  localDay,
  parseBreakdown,
  parseTrafficByDay,
  reportDue,
  roas,
  shiftDay,
} from './growth-metrics';

describe('localDay', () => {
  it('buckets by the store time zone, not UTC', () => {
    // 20:00 UTC on 9 Nov is 01:30 on 10 Nov in India.
    expect(localDay('2026-11-09T20:00:00Z', 'Asia/Kolkata')).toBe('2026-11-10');
    expect(localDay('2026-11-09T20:00:00Z', 'UTC')).toBe('2026-11-09');
  });
  it('falls back to UTC on a bad zone', () => {
    expect(localDay('2026-11-09T20:00:00Z', 'Not/AZone')).toBe('2026-11-09');
  });
});

describe('bucketOrders', () => {
  it('splits cancelled orders and skips test orders', () => {
    const map = bucketOrders(
      [
        { createdAt: '2026-11-09T05:00:00Z', cancelledAt: null, test: false, total: 1000.1 },
        { createdAt: '2026-11-09T06:00:00Z', cancelledAt: null, test: false, total: 499.9 },
        { createdAt: '2026-11-09T07:00:00Z', cancelledAt: '2026-11-09T09:00:00Z', test: false, total: 800 },
        { createdAt: '2026-11-09T08:00:00Z', cancelledAt: null, test: true, total: 5000 },
      ],
      'Asia/Kolkata'
    );
    expect(map.get('2026-11-09')).toEqual({ orders: 2, sales: 1500, cancelledOrders: 1, cancelledSales: 800 });
    expect(map.size).toBe(1);
  });
});

describe('roas', () => {
  it('returns null without spend and rounds to 2 places', () => {
    expect(roas(1000, 0)).toBeNull();
    expect(roas(null, 100)).toBeNull();
    expect(roas(1000, 300)).toBe(3.33);
  });
});

describe('days', () => {
  it('shifts and lists inclusive ranges', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-30', '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
  it('report is due after N days', () => {
    expect(reportDue(null, '2026-11-10', 15)).toEqual({ due: true, nextDue: null });
    expect(reportDue('2026-11-01', '2026-11-10', 15)).toEqual({ due: false, nextDue: '2026-11-16' });
    expect(reportDue('2026-10-20', '2026-11-10', 15).due).toBe(true);
  });
});

describe('ShopifyQL parsing', () => {
  it('reads daily sessions, cart and checkout columns by name', () => {
    const map = parseTrafficByDay({
      columns: ['day', 'sessions', 'sessions_with_cart_additions', 'sessions_that_completed_checkout'],
      rows: [
        { day: '2026-11-09', sessions: '1200', sessions_with_cart_additions: 60, sessions_that_completed_checkout: '12' },
        { day: 'bad', sessions: 1 },
      ],
    });
    expect(map.get('2026-11-09')).toEqual({ sessions: 1200, addToCart: 60, checkouts: 12 });
    expect(map.size).toBe(1);
  });
  it('returns nothing when the expected columns are missing', () => {
    expect(parseTrafficByDay({ columns: ['foo'], rows: [{ foo: 1 }] }).size).toBe(0);
  });
  it('sorts breakdowns by sessions', () => {
    const rows = parseBreakdown(
      {
        columns: ['landing_page_path', 'sessions', 'sessions_with_cart_additions'],
        rows: [
          { landing_page_path: '/a', sessions: 10, sessions_with_cart_additions: 1 },
          { landing_page_path: '/b', sessions: 30, sessions_with_cart_additions: 3 },
        ],
      },
      [/landing/i]
    );
    expect(rows.map((r) => r.name)).toEqual(['/b', '/a']);
    expect(rows[0]).toEqual({ name: '/b', sessions: 30, atc: 3 });
  });
});
