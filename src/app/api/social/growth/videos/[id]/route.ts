import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { videoIdeasService } from '@/modules/social/server/growth/records.service';

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/growth/videos/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc } = await growthRequest('draft');
    await videoIdeasService.remove(gc.organizationId, gc.customerId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
