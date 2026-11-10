import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { changeLogSchema } from '@/modules/social/server/growth/growth.schema';
import { changeLogService } from '@/modules/social/server/growth/records.service';

export async function GET() {
  try {
    const { gc } = await growthRequest('view');
    return Response.json(await changeLogService.list(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gc, userId, userName } = await growthRequest('draft');
    const input = changeLogSchema.parse(await request.json());
    return Response.json(
      await changeLogService.add(gc.organizationId, gc.customerId, { ...input, byName: input.byName || userName }, userId),
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
