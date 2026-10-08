import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentUser } from '@/modules/auth/server/session';
import { cookies } from 'next/headers';
import { HttpError } from './http-error';
import type { User, Organization } from '@prisma/client';

export type ClientPermission = 
  | 'view' 
  | 'draft' 
  | 'publish' 
  | 'approve' 
  | 'inbox' 
  | 'ads_view' 
  | 'ads_manage' 
  | 'leads' 
  | 'reports';

export interface AccessContext {
  user: User;
  organization: Organization;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  isPlatformAdmin: boolean;
  impersonatedBy: string | null;
  /** 'all' for OWNER/ADMIN; otherwise the customer ids this member can see. */
  clientIds: 'all' | string[];
  can(permission: ClientPermission, customerId: string | null): boolean;
}

export async function getAccess(): Promise<AccessContext> {
  let user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, 'Please log in');
  }

  let impersonatedBy: string | null = null;
  const cookieStore = await cookies();
  const impersonateId = cookieStore.get('podo_impersonate')?.value;

  if (impersonateId && user.isPlatformAdmin) {
    const targetUser = await prisma.user.findUnique({
      where: { id: impersonateId },
      include: { organization: true },
    });
    if (targetUser) {
      impersonatedBy = user.id;
      user = targetUser;
    }
  }

  const memberPerms = new Map<string, string[]>();
  let clientIds: 'all' | string[] = 'all';

  if (user.role === 'MEMBER') {
    const memberships = await prisma.socialClientMember.findMany({
      where: { userId: user.id },
    });
    clientIds = memberships.map(m => m.customerId);
    for (const m of memberships) {
      const perms = Array.isArray(m.permissions) ? m.permissions : [];
      memberPerms.set(m.customerId, perms as string[]);
    }
  }

  return {
    user,
    organization: user.organization,
    role: user.role,
    isPlatformAdmin: user.isPlatformAdmin,
    impersonatedBy,
    clientIds,
    can(permission: ClientPermission, customerId: string | null): boolean {
      if (user.role === 'OWNER' || user.role === 'ADMIN') return true;
      if (!customerId) return false;
      const perms = memberPerms.get(customerId) || [];
      if (perms.includes(permission)) return true;
      // Any permission implies view access
      if (permission === 'view' && perms.length > 0) return true;
      return false;
    }
  };
}

export async function requireRole(min: 'ADMIN' | 'OWNER'): Promise<AccessContext> {
  const ctx = await getAccess();
  if (ctx.role === 'MEMBER' || (min === 'OWNER' && ctx.role === 'ADMIN')) {
    throw new HttpError(403, 'You do not have permission to perform this action');
  }
  return ctx;
}

export async function requireClient(customerId: string, p: ClientPermission): Promise<AccessContext> {
  const ctx = await getAccess();
  if (!ctx.can(p, customerId)) {
    throw new HttpError(404, 'Not found'); // 404 to avoid leaking client existence
  }
  return ctx;
}

export async function requirePlatformAdmin(): Promise<AccessContext> {
  const ctx = await getAccess();
  if (!ctx.isPlatformAdmin) {
    throw new HttpError(404, 'Not found');
  }
  return ctx;
}
