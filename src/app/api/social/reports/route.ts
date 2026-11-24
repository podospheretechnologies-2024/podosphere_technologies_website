import { z } from 'zod';
import { reportService } from '@/modules/social/server/reports/report.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

const reportFilterSchema = z.object({
  customerId: z.string().min(1).max(64).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function GET(request: Request) {
  try {
    const scope = await getClientScope('reports');
    const params = new URL(request.url).searchParams;
    const filters = reportFilterSchema.parse({
      customerId: params.get('customerId') || undefined,
      month: params.get('month') || undefined,
    });
    return Response.json(await reportService.list(scope, filters));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Enqueue monthly PDF generation: optional `{ customerId, month: 'YYYY-MM' }`, else previous month for the scope. */
export async function POST(request: Request) {
  try {
    const scope = await getClientScope('reports');
    const body = reportFilterSchema.parse(await request.json().catch(() => ({})));
    return Response.json(await reportService.enqueueMonthlyPdfs(scope, body), { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
