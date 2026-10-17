import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { weeklyPlanService } from '@/modules/social/server/ai/weekly-plan.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

const bodySchema = z
  .object({
    /** When true, run for the first selected client inline (no Redis). Default: enqueue. */
    sync: z.boolean().optional(),
  })
  .optional();

export function GET() {
  return methodNotAllowed('POST');
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const raw = await request.json().catch(() => ({}));
    const body = bodySchema.parse(raw);

    if (body?.sync) {
      if (scope.customerIds === 'all' || scope.customerIds.length !== 1) {
        return Response.json(
          { error: 'Select a single client to run the weekly plan synchronously' },
          { status: 400 }
        );
      }
      const result = await weeklyPlanService.generateForClient({
        organizationId: scope.organizationId,
        customerId: scope.customerIds[0],
      });
      return Response.json(result);
    }

    return Response.json(await weeklyPlanService.enqueueForScope(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
