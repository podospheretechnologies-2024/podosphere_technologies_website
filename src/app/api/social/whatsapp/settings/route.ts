import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await whatsappOnboardingService.getAccountHealth(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await whatsappOnboardingService.configureWebhooks(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
