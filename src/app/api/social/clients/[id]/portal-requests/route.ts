import type { NextRequest } from 'next/server';
import { updatePortalRequestSchema } from '@/modules/social/server/portal/portal-requests.schema';
import { portalRequestsService } from '@/modules/social/server/portal/portal-requests.service';
import { requireClient } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Agency: list portal requests for this client. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const requests = await portalRequestsService.listForAgency(ctx.organization.id, id);
    return Response.json({ requests });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Agency: update status / reply on one request (`?requestId=`). */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const requestId = request.nextUrl.searchParams.get('requestId');
    if (!requestId) {
      return Response.json({ error: 'requestId is required' }, { status: 400 });
    }
    const body = updatePortalRequestSchema.parse(await request.json());
    const updated = await portalRequestsService.updateForAgency(
      ctx.organization.id,
      id,
      requestId,
      body
    );
    await logAudit({
      action: 'update_portal_request',
      targetType: 'SocialPortalRequest',
      targetId: updated.id,
      metadata: { customerId: id, status: body.status ?? null },
    });
    return Response.json({ request: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
