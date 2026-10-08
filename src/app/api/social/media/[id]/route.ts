import type { NextRequest } from 'next/server';
import { mediaService } from '@/modules/social/server/media/media.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/media/[id]'>) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    await mediaService.remove(organization.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
