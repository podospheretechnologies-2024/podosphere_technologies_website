import { prisma } from '@/shared/lib/prisma';
import { requireClient } from '@/shared/server/access';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    // Requires 'approve' on this specific client — previously any logged-in user could generate
    // a portal link for any client in the organization (PODO_SOCIAL_CLIENT_PLAN.md, problem C7).
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

    // Optional: pick a specific approver when a client has more than one. Defaults to the first,
    // matching the current UI (which only shows/links one approver per client today).
    const body = await req.json().catch(() => ({}) as { approverId?: string });
    const approver = body.approverId
      ? customer.approvers.find((a) => a.id === body.approverId)
      : customer.approvers[0];
    if (!approver) {
      throw new HttpError(404, 'Approver not found for this client');
    }

    const magicLink = await approvalService.generateMagicLink(approver.id);
    await logAudit({
      action: 'generate_approver_link',
      targetType: 'ClientApprover',
      targetId: approver.id,
      metadata: { customerId: id },
    });
    return Response.json({ magicLink });
  } catch (error) {
    return errorResponse(error);
  }
}
