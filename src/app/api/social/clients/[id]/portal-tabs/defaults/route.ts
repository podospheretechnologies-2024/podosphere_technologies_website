import type { NextRequest } from 'next/server';
import { portalTabsService } from '@/modules/social/server/portal/portal-tabs.service';
import { requireClient, requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';

/**
 * Agency OWNER/ADMIN: copy this client's current portalTabs into Organization.portalTabDefaults.
 * Existing clients are unchanged; only clients created after this get the default.
 */
export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireRole('ADMIN');
    await requireClient(id, 'approve');
    const defaults = await portalTabsService.saveClientAsOrgDefaults(ctx.organization.id, id);
    await logAudit({
      action: 'save_portal_tab_defaults',
      targetType: 'Organization',
      targetId: ctx.organization.id,
      metadata: { source: 'client', customerId: id, exists: defaults.exists },
    });
    return Response.json(defaults);
  } catch (error) {
    return errorResponse(error);
  }
}
