import type { NextRequest } from 'next/server';
import { bestTimesQuerySchema } from '@/modules/social/server/analytics/analytics.schema';
import { analyticsService } from '@/modules/social/server/analytics/analytics.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

/** Best weekday × hour slots from stored external posts for one channel. */
export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('view');
    const query = bestTimesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(
      await analyticsService.bestTimes(scope.organizationId, query, scope.customerIds)
    );
  } catch (error) {
    return errorResponse(error);
  }
}
