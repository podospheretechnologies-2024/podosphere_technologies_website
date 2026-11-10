import type { NextRequest } from 'next/server';
import { updatePortalApproverSchema } from '@/modules/social/server/portal/portal-auth.schema';
import { portalAuthService } from '@/modules/social/server/portal/portal-auth.service';
import { requireClient } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Agency: enable / disable a portal login, or update WhatsApp alert phone. */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string; approverId: string }> }
) {
  try {
    const { id, approverId } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const body = updatePortalApproverSchema.parse(await request.json());
    if (body.disabled === undefined && body.phone === undefined) {
      throw new HttpError(400, 'Nothing to update');
    }

    const approver = await portalAuthService.updateApprover(ctx.organization.id, id, approverId, {
      disabled: body.disabled,
      phone: body.phone,
    });

    if (body.disabled !== undefined) {
      await logAudit({
        action: body.disabled ? 'disable_portal_approver' : 'enable_portal_approver',
        targetType: 'ClientApprover',
        targetId: approverId,
        metadata: { customerId: id },
      });
    }
    if (body.phone !== undefined) {
      await logAudit({
        action: 'update_portal_approver_phone',
        targetType: 'ClientApprover',
        targetId: approverId,
        metadata: { customerId: id, hasPhone: Boolean(body.phone) },
      });
    }

    return Response.json({ approver });
  } catch (error) {
    return errorResponse(error);
  }
}
