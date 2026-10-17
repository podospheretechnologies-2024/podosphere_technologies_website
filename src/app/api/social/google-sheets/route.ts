import type { NextRequest } from 'next/server';
import { googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('view');
    const autoSync = request.nextUrl.searchParams.get('autoSync') === '1';
    return Response.json(await googleSheetsService.getStatus(scope.organizationId, { autoSync }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireRole('ADMIN');
    await googleSheetsService.disconnect(ctx.organization.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
