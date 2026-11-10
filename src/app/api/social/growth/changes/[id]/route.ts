import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { changeLogService } from '@/modules/social/server/growth/records.service';

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/growth/changes/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc } = await growthRequest('approve');
    await changeLogService.remove(gc.organizationId, gc.customerId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
