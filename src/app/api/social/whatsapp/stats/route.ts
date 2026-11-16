import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await whatsappOnboardingService.messageStats(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
