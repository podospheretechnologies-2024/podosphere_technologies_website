import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { writeBlogDraft } from '@/modules/social/server/growth/growth-ai.service';

/** AI writes (or rewrites, using the owner's feedback) the draft. */
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/social/growth/blogs/[id]/write'>) {
  try {
    const { id } = await ctx.params;
    const { gc } = await growthRequest('draft');
    return Response.json(await writeBlogDraft(gc, id));
  } catch (error) {
    return errorResponse(error);
  }
}
