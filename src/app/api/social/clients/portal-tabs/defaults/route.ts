import type { NextRequest } from 'next/server';
import { saveOrgPortalDefaultsSchema } from '@/modules/social/server/portal/portal-tabs.schema';
import { portalTabsService } from '@/modules/social/server/portal/portal-tabs.service';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/** Agency OWNER/ADMIN: read org default portal tab config for newly created clients. */
export async function GET() {
  try {
    const ctx = await requireRole('ADMIN');
    const defaults = await portalTabsService.getOrgDefaults(ctx.organization.id);
    return Response.json(defaults);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Agency OWNER/ADMIN: set org default from a PortalTabsConfig body (does not update existing clients). */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = saveOrgPortalDefaultsSchema.parse(await request.json());
    const config = {
      ...(body.tabs ? { tabs: body.tabs } : {}),
      ...(body.order ? { order: body.order } : {}),
      ...(body.adSpendVisible !== undefined ? { adSpendVisible: body.adSpendVisible } : {}),
      ...(body.whatsappDailyCap === null
        ? {}
        : body.whatsappDailyCap !== undefined
          ? { whatsappDailyCap: body.whatsappDailyCap }
          : {}),
      ...(body.whatsappBroadcastNeedsApproval === null
        ? {}
        : body.whatsappBroadcastNeedsApproval !== undefined
          ? { whatsappBroadcastNeedsApproval: body.whatsappBroadcastNeedsApproval }
          : {}),
    };
    const defaults = await portalTabsService.saveOrgDefaults(ctx.organization.id, config);
    await logAudit({
      action: 'save_portal_tab_defaults',
      targetType: 'Organization',
      targetId: ctx.organization.id,
      metadata: { source: 'body', exists: defaults.exists },
    });
    return Response.json(defaults);
  } catch (error) {
    return errorResponse(error);
  }
}
