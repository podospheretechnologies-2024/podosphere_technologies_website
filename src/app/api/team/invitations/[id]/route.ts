import { requireRole } from '@/shared/server/access';
import { invitationService } from '@/modules/auth/server/invitation.service';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Revoke a pending invite so its link stops working. ADMIN/OWNER only. */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireRole('ADMIN');
    await invitationService.revokeInvitation(ctx.organization.id, id);
    await logAudit({ action: 'team.invite_revoked', targetType: 'invitation', targetId: id });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
