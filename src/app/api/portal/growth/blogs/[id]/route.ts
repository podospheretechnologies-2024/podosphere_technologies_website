import type { NextRequest } from 'next/server';
import { portalGrowthBlogDecideSchema } from '@/modules/social/server/portal/portal-growth.schema';
import { portalGrowthBlogsService } from '@/modules/social/server/portal/portal-growth-blogs.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePortalTab('sales', 'act');
    const { id } = await params;
    const body = portalGrowthBlogDecideSchema.parse(await request.json());
    const blog = await portalGrowthBlogsService.decide(session, id, body.action, body.feedback);
    return Response.json({ blog });
  } catch (error) {
    return errorResponse(error);
  }
}
