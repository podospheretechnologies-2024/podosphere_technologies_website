import type { NextRequest } from 'next/server';
import { adAccountIdSchema, adsOverviewQuerySchema } from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// Totals, daily spend and campaigns for one ad account (read-only).
export async function GET(request: NextRequest, ctx: RouteContext<'/api/social/ads/accounts/[id]'>) {
  try {
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) {
      throw new HttpError(404, 'Not found');
    }
    const accountId = adAccountIdSchema.parse((await ctx.params).id);
    const date = adsOverviewQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await adsService.overview(scope, accountId, date));
  } catch (error) {
    return errorResponse(error);
  }
}
