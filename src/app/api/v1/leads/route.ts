import type { NextRequest } from 'next/server';
import { withApiKey } from '@/modules/social/server/api-clients/api-client.service';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    return await withApiKey('leads:read', request, async ({ scope }) => {
      return Response.json(await inboxService.listLeads(scope));
    });
  } catch (error) {
    return errorResponse(error);
  }
}
