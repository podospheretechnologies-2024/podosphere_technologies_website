import type { NextRequest } from 'next/server';
import { reschedulePostSchema, savePostSchema } from '@/modules/social/server/posts/post.schema';
import { postService } from '@/modules/social/server/posts/post.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Context = RouteContext<'/api/social/posts/[group]'>;

export async function GET(_request: NextRequest, ctx: Context) {
  try {
    const { group } = await ctx.params;
    const scope = await getClientScope('view');
    return Response.json(await postService.getGroup(scope, group));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, ctx: Context) {
  try {
    await requireRole('ADMIN');
    const { group } = await ctx.params;
    const body = savePostSchema.parse(await request.json());
    const scope = await getClientScope(body.type === 'draft' ? 'draft' : 'publish');
    return Response.json(await postService.update(scope, group, body));
  } catch (error) {
    return errorResponse(error);
  }
}

// Partial update: only moves the post to a new date (calendar drag and drop).
export async function PATCH(request: NextRequest, ctx: Context) {
  try {
    await requireRole('ADMIN');
    const { group } = await ctx.params;
    const scope = await getClientScope('publish');
    const body = reschedulePostSchema.parse(await request.json());
    await postService.reschedule(scope, group, body);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Context) {
  try {
    await requireRole('ADMIN');
    const { group } = await ctx.params;
    const scope = await getClientScope('draft');
    await postService.remove(scope, group);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
