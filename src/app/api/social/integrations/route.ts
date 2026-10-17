import { integrationService } from '@/modules/social/server/integrations/integration.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await integrationService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
