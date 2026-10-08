import { googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/social/google-sheets/spreadsheets/[id]'>
) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const { id } = await ctx.params;
    return Response.json(await googleSheetsService.getSpreadsheet(organization.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
