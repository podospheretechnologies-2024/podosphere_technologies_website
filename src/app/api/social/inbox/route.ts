import type { NextRequest } from 'next/server';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { planService } from '@/modules/social/server/billing/plan.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    await planService.assertFeature(scope.organizationId, 'inbox');
    const assigneeParam = request.nextUrl.searchParams.get('assigneeId');
    const aiLabel = request.nextUrl.searchParams.get('aiLabel') ?? undefined;
    const aiPriority = request.nextUrl.searchParams.get('aiPriority') ?? undefined;
    const options = {
      ...(assigneeParam === null
        ? {}
        : {
            assigneeId:
              assigneeParam === '' || assigneeParam === 'unassigned' ? null : assigneeParam,
          }),
      ...(aiLabel ? { aiLabel } : {}),
      ...(aiPriority ? { aiPriority } : {}),
    };
    return Response.json(await inboxService.listThreads(scope, options));
  } catch (error) {
    return errorResponse(error);
  }
}
