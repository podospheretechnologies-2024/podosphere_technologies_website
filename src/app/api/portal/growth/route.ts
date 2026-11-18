import { portalGrowthService } from '@/modules/social/server/portal/portal-growth.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal Growth overview (hero + performance). Session org+customer only. */
export async function GET() {
  try {
    const session = await requirePortalTab('sales', 'view');
    const data = await portalGrowthService.overview(session);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
