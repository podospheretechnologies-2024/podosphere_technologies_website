import { aiService } from '@/modules/social/server/ai/ai.service';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    return Response.json(aiService.status());
  } catch (error) {
    return errorResponse(error);
  }
}
