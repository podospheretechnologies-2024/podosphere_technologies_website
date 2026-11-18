import { describe, it, expect, vi } from 'vitest';
import {
  ORDER_FLOW_MARKETING_END_HOUR_IST,
  ORDER_FLOW_MARKETING_START_HOUR_IST,
} from '../../config/order-flows';
import { isWithinMarketingHoursIst, istHour } from './order-flow.worker';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/queue', () => ({ createQueueConnection: () => ({}) }));
vi.mock('../shopify/shopify-webhook.service', () => ({ sendDueOrderFlowMessage: vi.fn() }));
vi.mock('./order-flow.queue', () => ({
  getOrderFlowQueue: vi.fn(),
  closeOrderFlowQueue: vi.fn(),
  ORDER_FLOW_JOB: { processDue: 'orderFlow.processDue' },
  ORDER_FLOW_QUEUE_NAME: 'social-order-flow-queue',
}));
vi.mock('./order-flow.repository', () => ({ orderFlowRepository: { findDueMessages: vi.fn() } }));

describe('order-flow marketing hours (IST)', () => {
  it('exposes the plan window 10:00–21:00', () => {
    expect(ORDER_FLOW_MARKETING_START_HOUR_IST).toBe(10);
    expect(ORDER_FLOW_MARKETING_END_HOUR_IST).toBe(21);
  });

  it('istHour returns a 0–23 integer', () => {
    const hour = istHour(new Date('2026-11-17T12:00:00+05:30'));
    expect(hour).toBe(12);
  });

  it('isWithinMarketingHoursIst is true at noon IST and false at midnight IST', () => {
    expect(isWithinMarketingHoursIst(new Date('2026-11-17T12:00:00+05:30'))).toBe(true);
    expect(isWithinMarketingHoursIst(new Date('2026-11-17T09:59:00+05:30'))).toBe(false);
    expect(isWithinMarketingHoursIst(new Date('2026-11-17T21:00:00+05:30'))).toBe(false);
    expect(isWithinMarketingHoursIst(new Date('2026-11-17T20:59:00+05:30'))).toBe(true);
  });
});

describe('order-flow default delays (config)', () => {
  it('uses 45 min / 24 h / 5 days defaults from ORDER_FLOW_DEFINITIONS', async () => {
    const { ORDER_FLOW_BY_KEY } = await import('../../config/order-flows');
    expect(ORDER_FLOW_BY_KEY.abandoned_checkout_1.defaultDelay).toEqual({
      value: 45,
      unit: 'minutes',
    });
    expect(ORDER_FLOW_BY_KEY.abandoned_checkout_2.defaultDelay).toEqual({
      value: 24,
      unit: 'hours',
    });
    expect(ORDER_FLOW_BY_KEY.review_request.defaultDelay).toEqual({ value: 5, unit: 'days' });
  });
});
