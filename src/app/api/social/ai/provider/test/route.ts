import type { NextRequest } from 'next/server';
import {
  aiSettingsService,
  aiSettingsTestSchema,
} from '@/modules/social/server/ai/ai-settings.service';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

// Verify a provider + key + model with one tiny live call, without saving anything. Admin-only.
export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const body = aiSettingsTestSchema.parse(await request.json());
    return Response.json(await aiSettingsService.test(body));
  } catch (error) {
    return errorResponse(error);
  }
}
