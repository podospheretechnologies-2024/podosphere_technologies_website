import type { NextRequest } from 'next/server';
import { listPostsQuerySchema, savePostSchema } from '@/modules/social/server/posts/post.schema';
import { postService } from '@/modules/social/server/posts/post.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('view');
    const query = listPostsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await postService.list(scope, query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = savePostSchema.parse(await request.json());
    // Member-aware: getClientScope('draft'|'publish') narrows to the clients this user may act on,
    // and postService.create enforces that the chosen integration belongs to that scope.
    const scope = await getClientScope(body.type === 'draft' ? 'draft' : 'publish');
    return Response.json(await postService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
