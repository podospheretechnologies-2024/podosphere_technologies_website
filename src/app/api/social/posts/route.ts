import type { NextRequest } from 'next/server';
import { listPostsQuerySchema, savePostSchema } from '@/modules/social/server/posts/post.schema';
import { postService } from '@/modules/social/server/posts/post.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const query = listPostsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await postService.list(organization.id, query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = savePostSchema.parse(await request.json());
    return Response.json(await postService.create(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
