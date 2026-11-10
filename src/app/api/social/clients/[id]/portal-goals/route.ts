import type { NextRequest } from 'next/server';
import { portalGoalsSchema } from '@/modules/social/server/portal/portal-goals.schema';
import { portalGoalsService } from '@/modules/social/server/portal/portal-goals.service';
import { requireClient } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Agency: read portal goals / budget for this client. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    return Response.json(await portalGoalsService.get(ctx.organization.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Agency: set leads/posts targets and monthly ad budget. */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const body = portalGoalsSchema.parse(await request.json());
    const settings = await portalGoalsService.update(ctx.organization.id, id, body);
    await logAudit({
      action: 'update_portal_goals',
      targetType: 'SocialCustomer',
      targetId: id,
      metadata: body,
    });
    return Response.json(settings);
  } catch (error) {
    return errorResponse(error);
  }
}
