import { portalAdsService } from '@/modules/social/server/portal/portal-ads.service';
import { requirePortalSessionReady } from '@/shared/server/portal-session';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal Ads summary — customerId/org only from session. */
export async function GET() {
  try {
    const session = await requirePortalSessionReady();
    const data = await portalAdsService.summary(session);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
