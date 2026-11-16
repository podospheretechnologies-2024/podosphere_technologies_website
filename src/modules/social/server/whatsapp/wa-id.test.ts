import { describe, expect, it } from 'vitest';
import { toWaId } from './wa-id';

describe('toWaId', () => {
  it('keeps the country code Meta lead forms send', () => {
    expect(toWaId('+919119105802')).toBe('919119105802');
    expect(toWaId('+91 91191 05802')).toBe('919119105802');
    expect(toWaId('+1 (415) 555-0100')).toBe('14155550100');
  });

  it('adds 91 to a bare ten digit number', () => {
    expect(toWaId('9119105802')).toBe('919119105802');
    expect(toWaId('09119105802')).toBe('919119105802');
  });

  it('leaves a number that already has the country code', () => {
    expect(toWaId('919119105802')).toBe('919119105802');
  });

  it('rejects things that are not phone numbers', () => {
    expect(toWaId(null)).toBeNull();
    expect(toWaId('')).toBeNull();
    expect(toWaId('12345')).toBeNull();
    expect(toWaId('call me')).toBeNull();
  });
});
