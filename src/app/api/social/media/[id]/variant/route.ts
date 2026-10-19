import type { NextRequest } from 'next/server';
import { mediaVariantQuerySchema } from '@/modules/social/server/media/media.schema';
import { mediaService } from '@/modules/social/server/media/media.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

/** On-demand (or store) platform crop via sharp helper. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/social/media/[id]/variant'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    const query = mediaVariantQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const variant = await mediaService.getPlatformVariant(scope, id, query.key, query.store);
    return Response.json(variant);
  } catch (error) {
    return errorResponse(error);
  }
}
