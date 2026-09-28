import type { NextRequest } from 'next/server';
import { autopostService } from '@/modules/social/server/autoposts/autopost.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/autoposts/[id]/run'>
) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    return Response.json(await autopostService.run(organization.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
