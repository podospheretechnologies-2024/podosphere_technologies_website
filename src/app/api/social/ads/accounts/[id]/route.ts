import type { NextRequest } from 'next/server';
import { adAccountIdSchema, adsOverviewQuerySchema } from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { getCurrentUser } from '@/modules/auth/server/session';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// Totals, daily spend and campaigns for one ad account (read-only).
export async function GET(request: NextRequest, ctx: RouteContext<'/api/social/ads/accounts/[id]'>) {
  try {
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) {
      throw new HttpError(404, 'Not found');
    }
    const user = await getCurrentUser();
    const accountId = adAccountIdSchema.parse((await ctx.params).id);
    const date = adsOverviewQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await adsService.overview(org.id, accountId, date, user));
  } catch (error) {
    return errorResponse(error);
  }
}
