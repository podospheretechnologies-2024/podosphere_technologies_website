import type { NextRequest } from 'next/server';
import { googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const date = request.nextUrl.searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'Provide date as YYYY-MM-DD');
    }
    return Response.json(await googleSheetsService.contentForDate(organization.id, date));
  } catch (error) {
    return errorResponse(error);
  }
}
