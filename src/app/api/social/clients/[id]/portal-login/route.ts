import { cookies } from 'next/headers';
import { prisma } from '@/shared/lib/prisma';
import { requireClient } from '@/shared/server/access';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { APPROVER_SESSION_COOKIE } from '@/shared/server/portal-session';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/**
 * Agency staff can open the client portal as this client's approver without minting
 * (and consuming) a magic link. Does not bump tokenVersion, so outstanding client links stay valid.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');

    const customer = await prisma.socialCustomer.findFirst({
      where: { id, organizationId: ctx.organization.id },
      include: { approvers: true },
    });
    if (!customer) {
      throw new HttpError(404, 'Not found');
    }
    if (!customer.approvers.length) {
      throw new HttpError(400, 'No approvers found for this client');
    }

    const body = await req.json().catch(() => ({}) as { approverId?: string });
    const approver = body.approverId
      ? customer.approvers.find((a) => a.id === body.approverId)
      : customer.approvers[0];
    if (!approver) {
      throw new HttpError(404, 'Approver not found for this client');
    }

    const sessionToken = await approvalService.createPortalSession({
      approverId: approver.id,
      organizationId: approver.organizationId,
      customerId: approver.customerId,
    });

    const cookieStore = await cookies();
    cookieStore.set(APPROVER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
    });

    await logAudit({
      action: 'agency_portal_login',
      targetType: 'ClientApprover',
      targetId: approver.id,
      metadata: { customerId: id },
    });

    return Response.json({ redirectTo: '/approver/portal' });
  } catch (error) {
    return errorResponse(error);
  }
}
