import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  organizationScope,
  pinSelectedClientId,
  resolveSelectedClientId,
  scopeFromAccess,
  scopeWhere,
} from './client-scope';
import type { AccessContext } from './access';

vi.mock('server-only', () => ({}));
vi.mock('./access', () => ({ getAccess: vi.fn() }));

const cookieGet = vi.fn();
const headerGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
  headers: vi.fn(async () => ({ get: headerGet })),
}));

function ctx(clientIds: 'all' | string[], perms: Record<string, string[]> = {}): AccessContext {
  const held = (id: string) => perms[id] ?? ['view'];
  return {
    organization: { id: 'org-1' },
    role: clientIds === 'all' ? 'OWNER' : 'MEMBER',
    clientIds,
    can: (p: string, id: string | null) =>
      clientIds === 'all' || (!!id && (held(id).includes(p) || (p === 'view' && held(id).length > 0))),
  } as unknown as AccessContext;
}

describe('client scope', () => {
  it('organizationScope is all clients unless a customerId is set', () => {
    expect(organizationScope('org-1')).toEqual({ organizationId: 'org-1', customerIds: 'all' });
    expect(organizationScope('org-1', 'client-a')).toEqual({
      organizationId: 'org-1',
      customerIds: ['client-a'],
    });
  });

  it('OWNER/ADMIN without a pick sees every client of the organization', () => {
    const scope = scopeFromAccess(ctx('all'));
    expect(scope).toEqual({ organizationId: 'org-1', customerIds: 'all' });
    expect(scopeWhere(scope)).toEqual({ organizationId: 'org-1' });
  });

  it('OWNER/ADMIN who picks a client is narrowed to that client', () => {
    const scope = scopeFromAccess(ctx('all'), 'client-a');
    expect(scopeWhere(scope)).toEqual({ organizationId: 'org-1', customerId: { in: ['client-a'] } });
  });

  it('MEMBER is limited to their own clients (never null/agency rows)', () => {
    const scope = scopeFromAccess(ctx(['client-a']));
    expect(scopeWhere(scope)).toEqual({ organizationId: 'org-1', customerId: { in: ['client-a'] } });
  });

  it('MEMBER with no clients matches nothing', () => {
    expect(scopeWhere(scopeFromAccess(ctx([])))).toEqual({ organizationId: 'org-1', customerId: { in: [] } });
  });

  it('MEMBER of client A cannot pick client B (404)', () => {
    expect(() => scopeFromAccess(ctx(['client-a']), 'client-b')).toThrow('Not found');
  });

  it('MEMBER only gets clients where they hold the permission', () => {
    const c = ctx(['client-a', 'client-b'], { 'client-a': ['inbox'], 'client-b': ['draft'] });
    expect(scopeFromAccess(c, null, 'inbox').customerIds).toEqual(['client-a']);
    expect(() => scopeFromAccess(c, 'client-b', 'inbox')).toThrow('Not found');
  });

  it('MEMBER can pick one of their own clients', () => {
    const scope = scopeFromAccess(ctx(['client-a', 'client-b']), 'client-b');
    expect(scope.customerIds).toEqual(['client-b']);
  });

  it('MEMBER with several clients and no pick is pinned to the first assigned client', () => {
    expect(scopeFromAccess(ctx(['client-a', 'client-b'])).customerIds).toEqual(['client-a']);
  });
});

describe('resolveSelectedClientId', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    headerGet.mockReset();
  });

  it('prefers ?client= via x-podo-client over the cookie', async () => {
    headerGet.mockReturnValue('client-from-query');
    cookieGet.mockReturnValue({ value: 'client-from-cookie' });
    await expect(resolveSelectedClientId()).resolves.toBe('client-from-query');
  });

  it('reads podo_client when no query header is set', async () => {
    headerGet.mockReturnValue(null);
    cookieGet.mockReturnValue({ value: 'client-from-cookie' });
    await expect(resolveSelectedClientId()).resolves.toBe('client-from-cookie');
  });

  it('treats empty query as All clients', async () => {
    headerGet.mockReturnValue('');
    cookieGet.mockReturnValue({ value: 'client-from-cookie' });
    await expect(resolveSelectedClientId()).resolves.toBeNull();
  });
});

describe('pinSelectedClientId', () => {
  const clients = [{ id: 'client-a' }, { id: 'client-b' }];

  it('keeps a valid cookie pick', () => {
    expect(pinSelectedClientId('ADMIN', clients, 'client-b')).toBe('client-b');
    expect(pinSelectedClientId('MEMBER', [{ id: 'client-a' }], 'client-a')).toBe('client-a');
  });

  it('drops a cookie the user cannot see', () => {
    expect(pinSelectedClientId('MEMBER', [{ id: 'client-a' }], 'client-b')).toBe('client-a');
    expect(pinSelectedClientId('ADMIN', clients, 'client-z')).toBeNull();
  });

  it('pins a MEMBER with one client so they never land on All clients', () => {
    expect(pinSelectedClientId('MEMBER', [{ id: 'client-a' }], null)).toBe('client-a');
  });

  it('pins a MEMBER with several clients to the first assigned client', () => {
    expect(pinSelectedClientId('MEMBER', clients, null)).toBe('client-a');
  });

  it('does not invent a pick for ADMIN or OWNER', () => {
    expect(pinSelectedClientId('ADMIN', clients, null)).toBeNull();
    expect(pinSelectedClientId('OWNER', [{ id: 'client-a' }], null)).toBeNull();
  });
});
