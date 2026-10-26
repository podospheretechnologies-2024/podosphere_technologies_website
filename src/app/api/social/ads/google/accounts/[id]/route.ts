import type { NextRequest } from 'next/server';
import { adsOverviewQuerySchema } from '@/modules/social/server/ads/ads.schema';
import {
  googleAdsAssignBodySchema,
  googleAdsCustomerIdSchema,
} from '@/modules/social/server/google-ads/google-ads.schema';
import { googleAdsService } from '@/modules/social/server/google-ads/google-ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// Totals, daily spend, campaigns, ad groups and ads for one Google Ads account (read-only).
export async function GET(request: NextRequest, ctx: RouteContext<'/api/social/ads/google/accounts/[id]'>) {
  try {
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) throw new HttpError(404, 'Not found');
    const accountId = googleAdsCustomerIdSchema.parse((await ctx.params).id);
    const date = adsOverviewQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await googleAdsService.overview(scope, accountId, date));
  } catch (error) {
    return errorResponse(error);
  }
}

// Admin: assign (or clear) the Podo client this account belongs to.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/social/ads/google/accounts/[id]'>) {
  try {
    const { organization } = await requireRole('ADMIN');
    const accountId = googleAdsCustomerIdSchema.parse((await ctx.params).id);
    const body = googleAdsAssignBodySchema.parse(await request.json());
    await googleAdsService.assignAccount(organization.id, accountId, body.clientId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
