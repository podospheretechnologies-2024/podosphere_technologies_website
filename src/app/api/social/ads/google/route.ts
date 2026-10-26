import { googleAdsService } from '@/modules/social/server/google-ads/google-ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// Connection status plus the Google Ads accounts visible in the current client scope.
export async function GET() {
  try {
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) throw new HttpError(404, 'Not found');
    return Response.json(await googleAdsService.getStatus(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireRole('ADMIN');
    await googleAdsService.disconnect(ctx.organization.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
