import type { NextRequest } from 'next/server';
import { renameSetSchema } from '@/modules/social/server/sets/set.schema';
import { setService } from '@/modules/social/server/sets/set.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/sets/[id]'>) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    const body = renameSetSchema.parse(await request.json());
    return Response.json(await setService.rename(organization.id, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/sets/[id]'>) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    await setService.remove(organization.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
