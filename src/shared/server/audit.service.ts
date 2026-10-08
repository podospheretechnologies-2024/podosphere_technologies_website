import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { getAccess } from './access';
import { headers } from 'next/headers';

export interface AuditEvent {
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
}

export async function logAudit(event: AuditEvent) {
  try {
    const ctx = await getAccess();
    // In Next.js, getting IP requires reading headers (x-forwarded-for etc.)
    const headerStore = await headers();
    const forwardedFor = headerStore.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : null;

    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorUserId: ctx.user.id,
        impersonatorId: ctx.impersonatedBy,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata ?? undefined,
        ip: ip?.slice(0, 64),
      }
    });
  } catch (err) {
    // Silently fail if getAccess() throws (e.g., system jobs or unauthenticated actions)
    // or if DB fails, so we don't crash the main user action.
    console.error('Audit log failed:', err);
  }
}
