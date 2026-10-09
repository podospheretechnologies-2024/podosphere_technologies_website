import type { NextRequest } from 'next/server';
import { analyticsQuerySchema } from '@/modules/social/server/analytics/analytics.schema';
import { analyticsService } from '@/modules/social/server/analytics/analytics.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { getAccess } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export const maxDuration = 120;

// Publishing stats + Meta historical posts between two dates.
export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const ctx = await getAccess(); // Ensure user is logged in
    const query = analyticsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await analyticsService.summary(organization.id, query, ctx.clientIds));
  } catch (error) {
    return errorResponse(error);
  }
}
