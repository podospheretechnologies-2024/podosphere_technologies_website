import type { NextRequest } from 'next/server';
import { adsCreativeHelperBodySchema } from '@/modules/social/server/ads/ads.schema';
import { creativeHelperService } from '@/modules/social/server/ads/creative-helper.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

/**
 * F14 ads creative helper.
 * POST — generate 3 draft creatives from brand kit; queue for approval (never publishes / changes spend).
 * GET  — list pending draft creatives for the current client scope.
 * Agency OWNER/ADMIN only.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) {
      throw new HttpError(403, 'Ads are not enabled for this organization');
    }
    const status = request.nextUrl.searchParams.get('status') === 'all' ? 'all' : 'pending';
    return Response.json({ drafts: await creativeHelperService.list(scope, status) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();
    if (!canUseAds(org)) {
      throw new HttpError(403, 'Ads are not enabled for this organization');
    }
    const body = adsCreativeHelperBodySchema.parse(await request.json());
    const draft = await creativeHelperService.generate(scope, body);
    return Response.json({
      draft,
      // Explicit contract for clients / auditors.
      published: false,
      spendChanged: false,
      metaApiCalled: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
