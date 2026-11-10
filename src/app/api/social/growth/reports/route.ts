import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { growthReportsService } from '@/modules/social/server/growth/records.service';
import { generateGrowthReport } from '@/modules/social/server/growth/growth-ai.service';

export async function GET() {
  try {
    const { gc } = await growthRequest('reports');
    return Response.json(await growthReportsService.list(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const { gc } = await growthRequest('reports');
    return Response.json(await generateGrowthReport(gc), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
