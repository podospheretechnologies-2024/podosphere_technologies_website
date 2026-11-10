import type { NextRequest } from 'next/server';
import { googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { sheetScopeFor } from '@/modules/social/server/growth/content-sheet.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('view');
    const date = request.nextUrl.searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'Provide date as YYYY-MM-DD');
    }
    // The picked client's own calendar sheet only; never another client's sheet.
    return Response.json(await googleSheetsService.contentForDate(scope.organizationId, date, await sheetScopeFor(scope)));
  } catch (error) {
    return errorResponse(error);
  }
}
