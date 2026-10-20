import { adAccountIdSchema } from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// Catalogs for one ad account's business (agency OWNER/ADMIN only).
export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/social/ads/accounts/[id]/catalogs'>
) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) {
      throw new HttpError(404, 'Not found');
    }
    const accountId = adAccountIdSchema.parse((await ctx.params).id);
    return Response.json(await adsService.catalogs(scope, accountId));
  } catch (error) {
    return errorResponse(error);
  }
}
