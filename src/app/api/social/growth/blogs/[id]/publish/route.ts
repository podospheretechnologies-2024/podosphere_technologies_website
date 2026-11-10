import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { blogsService } from '@/modules/social/server/growth/records.service';

/** Publishes an APPROVED blog to the client's Shopify blog. The only write the desk makes to a store. */
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/social/growth/blogs/[id]/publish'>) {
  try {
    const { id } = await ctx.params;
    const { gc, userName } = await growthRequest('approve');
    return Response.json(await blogsService.publish(gc.organizationId, gc.customerId, id, userName));
  } catch (error) {
    return errorResponse(error);
  }
}
