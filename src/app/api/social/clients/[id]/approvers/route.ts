import type { NextRequest } from 'next/server';
import { createPortalApproverSchema } from '@/modules/social/server/portal/portal-auth.schema';
import { portalAuthService } from '@/modules/social/server/portal/portal-auth.service';
import { requireClient } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Agency: list portal logins for this client. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const approvers = await portalAuthService.listApprovers(ctx.organization.id, id);
    return Response.json({ approvers });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Agency: add a portal login (email + name). Password is set separately. */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const body = createPortalApproverSchema.parse(await request.json());
    const approver = await portalAuthService.createApprover(ctx.organization.id, id, body);
    await logAudit({
      action: 'create_portal_approver',
      targetType: 'ClientApprover',
      targetId: approver.id,
      metadata: { customerId: id, email: approver.email },
    });
    return Response.json({ approver }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
