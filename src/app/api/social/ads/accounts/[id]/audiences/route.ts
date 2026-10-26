import { adAccountIdSchema } from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// Custom audiences for one ad account (requires `ads_view` on its client).
export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/social/ads/accounts/[id]/audiences'>
) {
  try {
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) {
      throw new HttpError(404, 'Not found');
    }
    const accountId = adAccountIdSchema.parse((await ctx.params).id);
    return Response.json({ audiences: await adsService.audiences(scope, accountId) });
  } catch (error) {
    return errorResponse(error);
  }
}
