import type { NextRequest } from 'next/server';
import {
  adAccountIdSchema,
  adAccountTokenBodySchema,
} from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

/**
 * ADMIN+: set or rotate the encrypted Meta token for one ad account.
 * Body: `{ "accessToken": "<plain Meta system-user or business token>" }`.
 * The plaintext token is never returned.
 */
export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/social/ads/accounts/[id]/token'>
) {
  try {
    const org = await getCurrentOrganization();
    await requireRole('ADMIN');
    if (!canUseAds(org)) {
      throw new HttpError(404, 'Not found');
    }

    const accountId = adAccountIdSchema.parse((await ctx.params).id);
    const body = adAccountTokenBodySchema.parse(await request.json());
    await adsService.setAccountToken(org.id, accountId, body.accessToken);

    return Response.json({
      success: true,
      accountId,
      hasToken: true,
      refreshNeeded: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
