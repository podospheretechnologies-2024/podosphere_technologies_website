import type { NextRequest } from 'next/server';
import { googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const returnTo = request.nextUrl.searchParams.get('returnTo') === 'growth' ? 'growth' : 'automation';
    return Response.json(await googleSheetsService.getConnectUrl(organization.id, returnTo));
  } catch (error) {
    return errorResponse(error);
  }
}
