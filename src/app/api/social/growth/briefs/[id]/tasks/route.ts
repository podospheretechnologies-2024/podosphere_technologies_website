import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { briefsService } from '@/modules/social/server/growth/records.service';

/** Turns the brief's suggested tasks into real tasks (once). */
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/social/growth/briefs/[id]/tasks'>) {
  try {
    const { id } = await ctx.params;
    const { gc, userId } = await growthRequest('draft');
    return Response.json(await briefsService.addTasks(gc.organizationId, gc.customerId, id, userId));
  } catch (error) {
    return errorResponse(error);
  }
}
