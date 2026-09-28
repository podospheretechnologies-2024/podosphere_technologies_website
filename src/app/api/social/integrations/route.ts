import { integrationService } from '@/modules/social/server/integrations/integration.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    return Response.json(await integrationService.list(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}
