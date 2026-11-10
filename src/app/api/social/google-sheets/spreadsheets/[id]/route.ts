import { filterSheetRows, googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { sheetScopeFor } from '@/modules/social/server/growth/content-sheet.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/social/google-sheets/spreadsheets/[id]'>
) {
  try {
    const scope = await getClientScope('view');
    const { id } = await ctx.params;
    const sheet = await googleSheetsService.getSpreadsheet(scope.organizationId, id);
    if (scope.customerIds === 'all') return Response.json(sheet);
    const { exclude } = await sheetScopeFor(scope);
    if (!exclude.length) return Response.json(sheet);
    const [visible] = filterSheetRows([sheet], { exclude });
    if (!visible) throw new HttpError(404, 'Spreadsheet not found');
    return Response.json(visible);
  } catch (error) {
    return errorResponse(error);
  }
}
