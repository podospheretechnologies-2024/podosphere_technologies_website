import type { NextRequest } from 'next/server';
import { withApiKey } from '@/modules/social/server/api-clients/api-client.service';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    return await withApiKey('leads:read', request, async ({ organizationId }) => {
      return Response.json(await inboxService.listLeads(organizationId));
    });
  } catch (error) {
    return errorResponse(error);
  }
}
