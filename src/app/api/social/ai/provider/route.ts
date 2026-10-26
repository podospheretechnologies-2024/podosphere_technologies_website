import type { NextRequest } from 'next/server';
import {
  aiSettingsInputSchema,
  aiSettingsService,
} from '@/modules/social/server/ai/ai-settings.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

// AI provider + key config for the selected client (or the workspace default when "All clients").
// Admin-only; the stored key is never returned — GET exposes only its last 4 characters.

export async function GET() {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('view');
    return Response.json(await aiSettingsService.getDisplay(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('view');
    const body = aiSettingsInputSchema.parse(await request.json());
    return Response.json(await aiSettingsService.save(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('view');
    return Response.json(await aiSettingsService.remove(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
