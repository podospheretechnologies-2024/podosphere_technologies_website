import type { NextRequest } from 'next/server';
import { assignLeadsSchema } from '@/modules/social/server/inbox/inbox.schema';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { planService } from '@/modules/social/server/billing/plan.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('leads');
    await planService.assertFeature(scope.organizationId, 'leads');
    const stage = request.nextUrl.searchParams.get('stage') ?? undefined;
    const assigneeParam = request.nextUrl.searchParams.get('assigneeId');
    const options = {
      ...(stage ? { stage } : {}),
      ...(assigneeParam === null
        ? {}
        : { assigneeId: assigneeParam === '' || assigneeParam === 'unassigned' ? null : assigneeParam }),
    };
    return Response.json(await inboxService.listLeads(scope, options));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await getClientScope('leads');
    await planService.assertFeature(scope.organizationId, 'leads');
    const { leadIds, assigneeId } = assignLeadsSchema.parse(await request.json());
    return Response.json(await inboxService.assignLeads(scope, leadIds, assigneeId));
  } catch (error) {
    return errorResponse(error);
  }
}
