import type { NextRequest } from 'next/server';
import { updatePortalTabsSchema } from '@/modules/social/server/portal/portal-tabs.schema';
import { portalTabsService } from '@/modules/social/server/portal/portal-tabs.service';
import { requireClient } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Agency: read portal tab toggles + connection-derived defaults for this client. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const settings = await portalTabsService.getSettings(ctx.organization.id, id);
    return Response.json(settings);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Agency: set per-client portal tab visibility / ad spend visibility. */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireClient(id, 'approve');
    const body = updatePortalTabsSchema.parse(await request.json());
    const settings = await portalTabsService.updateSettings(ctx.organization.id, id, body);
    await logAudit({
      action: 'update_portal_tabs',
      targetType: 'SocialCustomer',
      targetId: id,
      metadata: { tabs: body.tabs ?? null, adSpendVisible: body.adSpendVisible ?? null },
    });
    return Response.json(settings);
  } catch (error) {
    return errorResponse(error);
  }
}
