import { prisma } from '@/shared/lib/prisma';
import { requireClient } from '@/shared/server/access';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Revoke outstanding magic links and portal sessions for a client's approver. */
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

    await approvalService.revokeApprover(approver.id);
    await logAudit({
      action: 'revoke_approver_link',
      targetType: 'ClientApprover',
      targetId: approver.id,
      metadata: { customerId: id },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
