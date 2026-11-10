import type { NextRequest } from 'next/server';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { adPlanDecisionSchema } from '@/modules/social/server/growth/growth.schema';
import { adPlanService } from '@/modules/social/server/growth/records.service';

/** Approve / reject (reviewers) or mark live (whoever built it in Ads Manager). */
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/social/growth/ad-plan/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc, userId, canReview } = await growthRequest('draft');
    const input = adPlanDecisionSchema.parse(await request.json());
    if (input.status !== 'live' && !canReview) throw new HttpError(403, 'Only reviewers can approve or reject ads.');
    return Response.json(
      await adPlanService.decide(gc.organizationId, gc.customerId, id, input.status, input.feedback ?? null, userId)
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/growth/ad-plan/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc } = await growthRequest('approve');
    await adPlanService.remove(gc.organizationId, gc.customerId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
