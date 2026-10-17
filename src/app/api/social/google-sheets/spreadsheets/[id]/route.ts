import { googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/social/google-sheets/spreadsheets/[id]'>
) {
  try {
    const scope = await getClientScope('view');
    const { id } = await ctx.params;
    return Response.json(await googleSheetsService.getSpreadsheet(scope.organizationId, id));
  } catch (error) {
    return errorResponse(error);
  }
}
