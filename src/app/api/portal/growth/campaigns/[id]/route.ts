import type { NextRequest } from 'next/server';
import { portalGrowthCampaignDecideSchema } from '@/modules/social/server/portal/portal-growth.schema';
import { portalGrowthCampaignsService } from '@/modules/social/server/portal/portal-growth-campaigns.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePortalTab('sales', 'act');
    const { id } = await params;
    const body = portalGrowthCampaignDecideSchema.parse(await request.json());
    const item = await portalGrowthCampaignsService.decide(
      session,
      id,
      body.status,
      body.feedback
    );
    return Response.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
