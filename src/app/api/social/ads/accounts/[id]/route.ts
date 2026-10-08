import type { NextRequest } from 'next/server';
import { adAccountIdSchema, adsOverviewQuerySchema } from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

// Totals, daily spend and campaigns for one ad account (read-only).
export async function GET(request: NextRequest, ctx: RouteContext<'/api/social/ads/accounts/[id]'>) {
  try {
    const org = await getCurrentOrganization();
    await requireRole('ADMIN');
    const accountId = adAccountIdSchema.parse((await ctx.params).id);
    const date = adsOverviewQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await adsService.overview(org.id, accountId, date));
  } catch (error) {
    return errorResponse(error);
  }
}
