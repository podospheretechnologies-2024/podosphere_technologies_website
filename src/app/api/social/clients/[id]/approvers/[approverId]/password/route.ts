import type { NextRequest } from 'next/server';
import { portalApproverPasswordActionSchema } from '@/modules/social/server/portal/portal-auth.schema';
import { portalAuthService } from '@/modules/social/server/portal/portal-auth.service';
import { requireClient } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/**
 * Agency password actions for a portal login:
 * - generate → one-time plaintext password (shown once in the UI)
 * - send_link → email a set-password link (or return the link when email is not configured)
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string; approverId: string }> }) {
  try {
    const { id, approverId } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const body = portalApproverPasswordActionSchema.parse(await request.json());

    if (body.action === 'generate') {
      const result = await portalAuthService.generatePassword(ctx.organization.id, id, approverId);
      await logAudit({
        action: 'generate_portal_password',
        targetType: 'ClientApprover',
        targetId: approverId,
        metadata: { customerId: id },
      });
      return Response.json({ password: result.password, approver: result.approver });
    }

    const result = await portalAuthService.sendSetPasswordLink(ctx.organization.id, id, approverId);
    await logAudit({
      action: 'send_portal_set_password',
      targetType: 'ClientApprover',
      targetId: approverId,
      metadata: { customerId: id, sent: result.sent },
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
