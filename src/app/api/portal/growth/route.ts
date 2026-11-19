import { portalGrowthService } from '@/modules/social/server/portal/portal-growth.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal Growth overview (hero + performance). Session org+customer only. */
export async function GET(request: Request) {
  try {
    const session = await requirePortalTab('sales', 'view');
    const raw = new URL(request.url).searchParams.get('days');
    const parsed = raw ? Number(raw) : 30;
    const days = Number.isFinite(parsed) && parsed > 0 && parsed <= 366 ? Math.floor(parsed) : 30;
    const data = await portalGrowthService.overview(session, { days });
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
