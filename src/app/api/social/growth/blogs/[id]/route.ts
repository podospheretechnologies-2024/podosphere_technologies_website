import type { NextRequest } from 'next/server';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { blogUpdateSchema } from '@/modules/social/server/growth/growth.schema';
import { blogsService } from '@/modules/social/server/growth/records.service';

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/social/growth/blogs/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc, canReview } = await growthRequest('draft');
    const input = blogUpdateSchema.parse(await request.json());
    if (input.status && ['approved', 'rejected', 'changes'].includes(input.status) && !canReview) {
      throw new HttpError(403, 'Only reviewers can approve, reject or ask for changes.');
    }
    return Response.json(await blogsService.update(gc.organizationId, gc.customerId, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/growth/blogs/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc } = await growthRequest('approve');
    await blogsService.remove(gc.organizationId, gc.customerId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
