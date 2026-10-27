import type { NextRequest } from 'next/server';
import {
  adAccountIdSchema,
  adsOverviewQuerySchema,
  adsReportExtrasSchema,
} from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// In-app Ads Reporting: campaign/ad set/ad rows with optional Meta breakdowns.
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) throw new HttpError(404, 'Not found');
    const accountId = adAccountIdSchema.parse((await ctx.params).id);
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const date = adsOverviewQuerySchema.parse(params);
    const extras = adsReportExtrasSchema.parse(params);
    return Response.json(
      await adsService.report(scope, accountId, date, extras.level, extras.breakdown, extras.compare)
    );
  } catch (error) {
    return errorResponse(error);
  }
}
