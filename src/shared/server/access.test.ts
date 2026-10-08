import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccess, requireRole, requireClient } from './access';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentUser } from '@/modules/auth/server/session';

vi.mock('server-only', () => ({}));

// Mock dependencies
vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    socialClientMember: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn(),
    }
  }
}));

vi.mock('@/modules/auth/server/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

describe('Authorization & Access Rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.socialClientMember.findMany).mockResolvedValue([]);
  });

  const mockOrg = { id: 'org-1', name: 'Test Org' };
  
  it('throws 401 if user is not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(getAccess()).rejects.toThrow('Please log in');
  });

  describe('OWNER role', () => {
    const ownerUser = { id: 'u1', role: 'OWNER', isPlatformAdmin: false, organization: mockOrg };

    it('has all client permissions by default', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(ownerUser as any);
      const ctx = await getAccess();
      
      expect(ctx.role).toBe('OWNER');
      expect(ctx.can('view', 'any-client')).toBe(true);
      expect(ctx.can('publish', 'any-client')).toBe(true);
    });

    it('passes requireRole("ADMIN")', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(ownerUser as any);
      await expect(requireRole('ADMIN')).resolves.toBeDefined();
    });
  });

  describe('ADMIN role', () => {
    const adminUser = { id: 'u2', role: 'ADMIN', isPlatformAdmin: false, organization: mockOrg };

    it('has all client permissions by default', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser as any);
      const ctx = await getAccess();
      
      expect(ctx.role).toBe('ADMIN');
      expect(ctx.can('view', 'any-client')).toBe(true);
      expect(ctx.can('publish', 'any-client')).toBe(true);
    });

    it('fails requireRole("OWNER")', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser as any);
      await expect(requireRole('OWNER')).rejects.toThrow('You do not have permission');
    });
  });

  describe('MEMBER role', () => {
    const memberUser = { id: 'u3', role: 'MEMBER', isPlatformAdmin: false, organization: mockOrg };

    it('fails requireRole("ADMIN")', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(memberUser as any);
      await expect(requireRole('ADMIN')).rejects.toThrow('You do not have permission');
    });

    it('only has access to assigned clients with correct permissions', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(memberUser as any);
      vi.mocked(prisma.socialClientMember.findMany).mockResolvedValue([
        { customerId: 'client-1', permissions: ['view', 'draft'] } as any
      ]);

      const ctx = await getAccess();
      
      expect(ctx.role).toBe('MEMBER');
      
      // Has access to client-1
      expect(ctx.can('view', 'client-1')).toBe(true);
      expect(ctx.can('draft', 'client-1')).toBe(true);
      
      // But not publish on client-1
      expect(ctx.can('publish', 'client-1')).toBe(false);
      
      // No access to client-2
      expect(ctx.can('view', 'client-2')).toBe(false);
    });

    it('fails requireClient if not assigned', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(memberUser as any);
      vi.mocked(prisma.socialClientMember.findMany).mockResolvedValue([]);
      
      await expect(requireClient('client-99', 'view')).rejects.toThrow('Not found');
    });
  });
});
