import { portalGrowthCampaignsService } from '@/modules/social/server/portal/portal-growth-campaigns.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const session = await requirePortalTab('sales', 'view');
    const items = await portalGrowthCampaignsService.list(session);
    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
