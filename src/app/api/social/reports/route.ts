import { reportService } from '@/modules/social/server/reports/report.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('reports');
    return Response.json(await reportService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Enqueue monthly PDF generation for each client in the current scope. */
export async function POST() {
  try {
    const scope = await getClientScope('reports');
    return Response.json(await reportService.enqueueMonthlyPdfs(scope), { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
