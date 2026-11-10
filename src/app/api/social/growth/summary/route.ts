import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';
import { clientsSummary } from '@/modules/social/server/growth/growth.service';

export async function GET() {
  try {
    return Response.json(await clientsSummary(await getClientScope('view')));
  } catch (error) {
    return errorResponse(error);
  }
}
