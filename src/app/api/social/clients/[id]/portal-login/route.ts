import { prisma } from '@/shared/lib/prisma';
import { requireClient } from '@/shared/server/access';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { setPortalSessionCookie } from '@/shared/server/portal-session';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/**
 * Agency staff can open the client portal as this client's approver without minting
 * (and consuming) a magic link. Does not bump tokenVersion, so outstanding client links stay valid.
 * Uses agencyPreview so a temporary/generated password does not force the agency through change-password.
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
      throw new HttpError(400, 'No portal logins found for this client. Add one under Portal access.');
    }

    const body = await req.json().catch(() => ({}) as { approverId?: string });
    const enabled = customer.approvers.filter((row) => !row.disabledAt);
    const approver = body.approverId
      ? customer.approvers.find((row) => row.id === body.approverId)
      : enabled[0] ?? customer.approvers[0];
    if (!approver) {
      throw new HttpError(404, 'Portal login not found for this client');
    }
    if (approver.disabledAt) {
      throw new HttpError(400, 'That portal login is disabled. Enable it under Portal access first.');
    }

    const sessionToken = await approvalService.createPortalSession(
      {
        approverId: approver.id,
        organizationId: approver.organizationId,
        customerId: approver.customerId,
      },
      '12h',
      { agencyPreview: true }
    );
    await setPortalSessionCookie(sessionToken, '12h');

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
