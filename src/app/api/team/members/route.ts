import { requireRole } from '@/shared/server/access';
import { invitationService } from '@/modules/auth/server/invitation.service';
import { errorResponse } from '@/shared/server/http-error';

/** Active members + pending invites for the current organization. ADMIN/OWNER only. */
export async function GET() {
  try {
    const ctx = await requireRole('ADMIN');
    const [members, invitations] = await Promise.all([
      invitationService.listMembers(ctx.organization.id),
      invitationService.listPendingInvitations(ctx.organization.id),
    ]);
    return Response.json({ members, invitations, currentUserId: ctx.user.id });
  } catch (error) {
    return errorResponse(error);
  }
}
