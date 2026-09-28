import type { NextRequest } from 'next/server';
import { savePostSchema } from '@/modules/social/server/posts/post.schema';
import { postService } from '@/modules/social/server/posts/post.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

type Context = RouteContext<'/api/social/posts/[group]'>;

export async function GET(_request: NextRequest, ctx: Context) {
  try {
    const { group } = await ctx.params;
    const organization = await getCurrentOrganization();
    return Response.json(await postService.getGroup(organization.id, group));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, ctx: Context) {
  try {
    const { group } = await ctx.params;
    const organization = await getCurrentOrganization();
    const body = savePostSchema.parse(await request.json());
    return Response.json(await postService.update(organization.id, group, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Context) {
  try {
    const { group } = await ctx.params;
    const organization = await getCurrentOrganization();
    await postService.remove(organization.id, group);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
