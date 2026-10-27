import type { NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { invitationService } from '@/modules/auth/server/invitation.service';
import { createInvitationSchema } from '@/modules/auth/server/invitation.schema';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Mint a one-time invite link for a new staff member. Returns the link to copy & share. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = createInvitationSchema.parse(await request.json());
    const result = await invitationService.createInvitation(ctx.organization.id, ctx.user.id, body);
    await logAudit({
      action: 'team.invite_created',
      targetType: 'invitation',
      targetId: result.email,
      metadata: { role: result.role },
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
