import type { NextRequest } from 'next/server';
import {
  adAccountIdSchema,
  adsEntityStatusBodySchema,
} from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

/** ADMIN: pause or resume selected campaigns / ad sets / ads. Never creates or changes spend. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) throw new HttpError(404, 'Not found');
    const accountId = adAccountIdSchema.parse((await ctx.params).id);
    const body = adsEntityStatusBodySchema.parse(await request.json());
    return Response.json(
      await adsService.setEntityStatus(scope, accountId, body.kind, body.ids, body.status)
    );
  } catch (error) {
    return errorResponse(error);
  }
}
