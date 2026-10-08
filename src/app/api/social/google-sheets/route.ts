import type { NextRequest } from 'next/server';
import { googleSheetsService } from '@/modules/social/server/google-sheets/google-sheets.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const autoSync = request.nextUrl.searchParams.get('autoSync') === '1';
    return Response.json(await googleSheetsService.getStatus(organization.id, { autoSync }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    await googleSheetsService.disconnect(organization.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
