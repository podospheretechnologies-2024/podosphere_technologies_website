import type { NextRequest } from 'next/server';
import { filterSheetRows, googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { sheetScopeFor } from '@/modules/social/server/growth/content-sheet.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('view');
    const autoSync = request.nextUrl.searchParams.get('autoSync') === '1';
    const status = await googleSheetsService.getStatus(scope.organizationId, { autoSync });
    if (scope.customerIds === 'all') return Response.json(status);
    // A picked client (or a member) only sees sheets not linked to other clients.
    const { exclude } = await sheetScopeFor(scope);
    if (!exclude.length) return Response.json(status);
    return Response.json({ ...status, spreadsheets: filterSheetRows(status.spreadsheets, { exclude }) });
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
