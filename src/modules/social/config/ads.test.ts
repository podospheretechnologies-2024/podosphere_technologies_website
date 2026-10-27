import { describe, expect, it } from 'vitest';
import { previousAdsRange } from './ads';

describe('previousAdsRange', () => {
  it('shifts a custom range back by the same number of days', () => {
    expect(previousAdsRange({ mode: 'range', since: '2026-10-11', until: '2026-10-20' })).toEqual({
      since: '2026-10-01',
      until: '2026-10-10',
    });
  });

  it('uses the preset length ending the day before the current window', () => {
    expect(
      previousAdsRange({ mode: 'preset', datePreset: 'last_7d' }, new Date('2026-10-26T12:00:00.000Z'))
    ).toEqual({
      since: '2026-10-13',
      until: '2026-10-19',
    });
  });
});
