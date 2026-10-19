import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { extractBearerToken, hashApiToken, isIpAllowed } from './api-key';

vi.mock('server-only', () => ({}));

describe('hashApiToken', () => {
  it('returns a stable sha256 hex digest', () => {
    const token = 'ps_live_abc123';
    const expected = createHash('sha256').update(token).digest('hex');
    expect(hashApiToken(token)).toBe(expected);
    expect(hashApiToken(token)).toBe(hashApiToken(token));
  });

  it('differs for different tokens', () => {
    expect(hashApiToken('a')).not.toBe(hashApiToken('b'));
  });
});

describe('extractBearerToken', () => {
  it('extracts a Bearer token', () => {
    expect(extractBearerToken('Bearer ps_live_xyz')).toBe('ps_live_xyz');
  });

  it('returns null for missing or non-Bearer headers', () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer ')).toBeNull();
  });
});

describe('isIpAllowed', () => {
  it('allows any IP when the allowlist is empty', () => {
    expect(isIpAllowed(null, null)).toBe(true);
    expect(isIpAllowed('', '1.2.3.4')).toBe(true);
    expect(isIpAllowed('   ', '1.2.3.4')).toBe(true);
  });

  it('requires an IP when an allowlist is set', () => {
    expect(isIpAllowed('1.2.3.4', null)).toBe(false);
  });

  it('matches exact IPs in a comma-separated list', () => {
    expect(isIpAllowed('1.2.3.4, 5.6.7.8', '5.6.7.8')).toBe(true);
    expect(isIpAllowed('1.2.3.4, 5.6.7.8', '9.9.9.9')).toBe(false);
  });

  it('matches CIDR-like prefixes via startsWith on the part before /', () => {
    // Production strips `/mask` then uses startsWith — so the rule must be a real IP prefix.
    expect(isIpAllowed('10.0.0./24', '10.0.0.50')).toBe(true);
    expect(isIpAllowed('10.0.0./24', '10.1.0.50')).toBe(false);
  });
});
