import type { NextRequest } from 'next/server';
import { copyPortalTabsSchema } from '@/modules/social/server/portal/portal-tabs.schema';
import { portalTabsService } from '@/modules/social/server/portal/portal-tabs.service';
import { requireClient } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Agency: copy this client's portal tab settings onto other clients the user may manage. */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const body = copyPortalTabsSchema.parse(await request.json());
    // Only clients this user may manage; anything else is dropped silently.
    const targets = body.targetClientIds.filter((clientId) => ctx.can('approve', clientId));
    const result = await portalTabsService.copySettings(ctx.organization.id, id, targets);
    await logAudit({
      action: 'copy_portal_tabs',
      targetType: 'SocialCustomer',
      targetId: id,
      metadata: { targetClientIds: targets, updated: result.updated },
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
