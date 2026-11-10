import type { NextRequest } from 'next/server';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { taskUpdateSchema } from '@/modules/social/server/growth/growth.schema';
import { tasksService } from '@/modules/social/server/growth/tasks.service';

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/social/growth/tasks/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc, userId, canReview } = await growthRequest('draft');
    const input = taskUpdateSchema.parse(await request.json());
    return Response.json(await tasksService.update(gc.organizationId, gc.customerId, id, input, userId, canReview));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/growth/tasks/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc, canReview } = await growthRequest('draft');
    if (!canReview) throw new HttpError(403, 'Only reviewers can delete tasks.');
    await tasksService.remove(gc.organizationId, gc.customerId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
