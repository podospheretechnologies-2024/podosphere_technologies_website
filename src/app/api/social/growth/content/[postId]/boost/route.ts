import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { boostSchema } from '@/modules/social/server/growth/growth.schema';
import { contentService } from '@/modules/social/server/growth/records.service';

/** Marks a post for boosting (plan only; the boost itself is done by a person in Meta). */
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/growth/content/[postId]/boost'>) {
  try {
    const { postId } = await ctx.params;
    const { gc } = await growthRequest('draft');
    const input = boostSchema.parse(await request.json());
    return Response.json(
      await contentService.setBoost(gc.organizationId, gc.customerId, postId, {
        boost: input.boost,
        budget: input.budget ?? null,
        spend: input.spend ?? null,
        note: input.note ?? null,
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}
