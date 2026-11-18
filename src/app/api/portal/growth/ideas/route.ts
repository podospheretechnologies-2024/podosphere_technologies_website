import type { NextRequest } from 'next/server';
import { portalGrowthIdeaCreateSchema } from '@/modules/social/server/portal/portal-growth.schema';
import { portalGrowthIdeasService } from '@/modules/social/server/portal/portal-growth-ideas.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const session = await requirePortalTab('sales', 'view');
    const ideas = await portalGrowthIdeasService.list(session);
    return Response.json({ ideas });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalTab('sales', 'act');
    const body = portalGrowthIdeaCreateSchema.parse(await request.json());
    const idea = await portalGrowthIdeasService.create(session, body);
    return Response.json({ idea }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
