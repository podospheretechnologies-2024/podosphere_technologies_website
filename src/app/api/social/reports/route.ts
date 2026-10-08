import { reportService } from '@/modules/social/server/reports/report.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await reportService.list(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await reportService.generate(organization.id), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
