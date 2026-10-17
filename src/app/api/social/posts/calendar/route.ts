import type { NextRequest } from 'next/server';
import { calendarQuerySchema } from '@/modules/social/server/posts/post.schema';
import { postService } from '@/modules/social/server/posts/post.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

// Posts between two dates, for the day / week / month calendar views.
export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('view');
    const query = calendarQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await postService.listRange(scope, query));
  } catch (error) {
    return errorResponse(error);
  }
}
