import type { NextRequest } from 'next/server';
import { analyticsQuerySchema } from '@/modules/social/server/analytics/analytics.schema';
import { analyticsService } from '@/modules/social/server/analytics/analytics.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export const maxDuration = 120;

// Publishing stats + Meta historical posts between two dates.
export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('view');
    const query = analyticsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await analyticsService.summary(scope.organizationId, query, scope.customerIds));
  } catch (error) {
    return errorResponse(error);
  }
}
