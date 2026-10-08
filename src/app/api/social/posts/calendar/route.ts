import type { NextRequest } from 'next/server';
import { calendarQuerySchema } from '@/modules/social/server/posts/post.schema';
import { postService } from '@/modules/social/server/posts/post.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

// Posts between two dates, for the day / week / month calendar views.
export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const query = calendarQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await postService.listRange(organization.id, query));
  } catch (error) {
    return errorResponse(error);
  }
}
