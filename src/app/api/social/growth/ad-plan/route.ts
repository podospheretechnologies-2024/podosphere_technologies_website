import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { adPlanCreateSchema } from '@/modules/social/server/growth/growth.schema';
import { adPlanService } from '@/modules/social/server/growth/records.service';
import { generateAdPlan } from '@/modules/social/server/growth/growth-ai.service';

export async function GET() {
  try {
    const { gc, canReview } = await growthRequest('view');
    return Response.json({ items: await adPlanService.list(gc.organizationId, gc.customerId), canReview });
  } catch (error) {
    return errorResponse(error);
  }
}

/** { generate: true, brief? } asks the AI for new ads; { item } adds one by hand. Both land as "pending". */
export async function POST(request: NextRequest) {
  try {
    const { gc } = await growthRequest('draft');
    const input = adPlanCreateSchema.parse(await request.json());
    if ('item' in input) {
      return Response.json(await adPlanService.createMany(gc.organizationId, gc.customerId, [input.item], 'manual'), {
        status: 201,
      });
    }
    return Response.json(await generateAdPlan(gc, input.brief ?? null), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
