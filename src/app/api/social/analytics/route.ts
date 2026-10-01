import type { NextRequest } from 'next/server';
import { analyticsQuerySchema } from '@/modules/social/server/analytics/analytics.schema';
import { analyticsService } from '@/modules/social/server/analytics/analytics.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export const maxDuration = 60;

// Publishing stats between two dates: totals, per channel and per post outcome.
export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const query = analyticsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await analyticsService.summary(organization.id, query));
  } catch (error) {
    return errorResponse(error);
  }
}
