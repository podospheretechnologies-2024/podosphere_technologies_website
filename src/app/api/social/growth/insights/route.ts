import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { insightsService } from '@/modules/social/server/growth/records.service';
import { generateInsights } from '@/modules/social/server/growth/growth-ai.service';

export async function GET() {
  try {
    const { gc } = await growthRequest('view');
    return Response.json(await insightsService.list(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Run today's findings + tasks now (the worker also runs it once a day). */
export async function POST() {
  try {
    const { gc } = await growthRequest('draft');
    return Response.json(await generateInsights(gc));
  } catch (error) {
    return errorResponse(error);
  }
}
