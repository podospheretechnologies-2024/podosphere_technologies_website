import { portalGrowthContentService } from '@/modules/social/server/portal/portal-growth-content.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const session = await requirePortalTab('sales', 'view');
    const data = await portalGrowthContentService.summary(session);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
