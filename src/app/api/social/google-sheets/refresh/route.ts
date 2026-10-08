import { googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function POST() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await googleSheetsService.refresh(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}
