import { requireRole } from '@/shared/server/access';
import { invitationService } from '@/modules/auth/server/invitation.service';
import { setMemberClientsSchema } from '@/modules/auth/server/invitation.schema';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Replace which clients a MEMBER can see, and what they may do on each. ADMIN/OWNER only. */
export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireRole('ADMIN');
    const body = setMemberClientsSchema.parse(await request.json());
    const clients = await invitationService.setMemberClients(ctx.organization.id, id, body);
    await logAudit({
      action: 'team.member_clients_set',
      targetType: 'user',
      targetId: id,
      metadata: { clients: clients.length },
    });
    return Response.json({ clients });
  } catch (error) {
    return errorResponse(error);
  }
}
