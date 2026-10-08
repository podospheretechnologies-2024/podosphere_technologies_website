import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { requirePlatformAdmin } from '@/shared/server/access';
import { cookies } from 'next/headers';
import { logAudit } from '@/shared/server/audit.service';
import { HttpError } from '@/shared/server/http-error';

export const adminService = {
  async listOrganizations() {
    await requirePlatformAdmin();
    return prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true, socialCustomers: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getSyncHealth() {
    await requirePlatformAdmin();
    return prisma.socialSyncState.findMany({
      where: { failures: { gt: 0 } },
      orderBy: { failures: 'desc' },
      take: 100
    });
  },

  async getAiUsage() {
    await requirePlatformAdmin();
    return prisma.socialAiUsage.groupBy({
      by: ['organizationId'],
      _sum: {
        inputTokens: true,
        outputTokens: true,
      }
    });
  },

  async impersonateUser(targetUserId: string) {
    const ctx = await requirePlatformAdmin();
    
    // You cannot impersonate if you are already impersonating
    if (ctx.impersonatedBy) {
      throw new HttpError(400, 'Already impersonating someone');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });
    if (!targetUser) throw new HttpError(404, 'User not found');

    const cookieStore = await cookies();
    cookieStore.set('podo_impersonate', targetUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour max impersonation
    });

    await logAudit({
      action: 'admin.impersonate_start',
      targetType: 'user',
      targetId: targetUser.id,
      metadata: { originalUser: ctx.user.id }
    });
  },

  async stopImpersonating() {
    const cookieStore = await cookies();
    const currentImpersonate = cookieStore.get('podo_impersonate')?.value;
    if (currentImpersonate) {
      cookieStore.delete('podo_impersonate');
      await logAudit({
        action: 'admin.impersonate_stop',
        targetType: 'user',
        targetId: currentImpersonate,
      });
    }
  }
};
