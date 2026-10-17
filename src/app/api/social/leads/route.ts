import type { NextRequest } from 'next/server';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { planService } from '@/modules/social/server/billing/plan.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('leads');
    await planService.assertFeature(scope.organizationId, 'leads');
    const stage = request.nextUrl.searchParams.get('stage') ?? undefined;
    return Response.json(await inboxService.listLeads(scope, stage ? { stage } : undefined));
  } catch (error) {
    return errorResponse(error);
  }
}
