import { googleAdsService } from '@/modules/social/server/google-ads/google-ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// Starts the Google Ads OAuth flow (admin only).
export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    if (!canUseAds(organization)) throw new HttpError(404, 'Not found');
    return Response.json(await googleAdsService.getConnectUrl(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}
