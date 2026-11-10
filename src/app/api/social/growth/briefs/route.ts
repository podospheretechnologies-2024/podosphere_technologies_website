import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { briefSchema } from '@/modules/social/server/growth/growth.schema';
import { briefsService } from '@/modules/social/server/growth/records.service';
import { runBrief } from '@/modules/social/server/growth/growth-ai.service';

export async function GET() {
  try {
    const { gc } = await growthRequest('view');
    return Response.json(await briefsService.list(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gc, userId } = await growthRequest('draft');
    const input = briefSchema.parse(await request.json());
    return Response.json(await runBrief(gc, input.area, input.ask, userId), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
