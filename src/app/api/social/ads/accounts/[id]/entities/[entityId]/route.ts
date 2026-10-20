import type { NextRequest } from 'next/server';
import {
  adAccountIdSchema,
  adsEntityIdSchema,
  adsEntityKindSchema,
  adsOverviewQuerySchema,
} from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

/** Period totals + daily history for one campaign, ad set, or ad (agency OWNER/ADMIN only). */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/social/ads/accounts/[id]/entities/[entityId]'>
) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('ads_view');
    const params = await ctx.params;
    const accountId = adAccountIdSchema.parse(params.id);
    const entityId = adsEntityIdSchema.parse(params.entityId);
    const kind = adsEntityKindSchema.parse(request.nextUrl.searchParams.get('kind') ?? 'ad');
    const date = adsOverviewQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await adsService.entityHistory(scope, accountId, kind, entityId, date));
  } catch (error) {
    return errorResponse(error);
  }
}
