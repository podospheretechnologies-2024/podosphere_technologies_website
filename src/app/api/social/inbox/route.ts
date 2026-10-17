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
    const options =
      assigneeParam === null
        ? undefined
        : { assigneeId: assigneeParam === '' || assigneeParam === 'unassigned' ? null : assigneeParam };
    return Response.json(await inboxService.listThreads(scope, options));
  } catch (error) {
    return errorResponse(error);
  }
}
