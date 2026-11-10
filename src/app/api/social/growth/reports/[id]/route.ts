import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { growthReportsService } from '@/modules/social/server/growth/records.service';

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/growth/reports/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { gc } = await growthRequest('approve');
    await growthReportsService.remove(gc.organizationId, gc.customerId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
