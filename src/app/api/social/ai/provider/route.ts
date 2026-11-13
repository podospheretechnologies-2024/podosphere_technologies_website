import type { NextRequest } from 'next/server';
import {
  aiSettingsInputSchema,
  aiSettingsService,
} from '@/modules/social/server/ai/ai-settings.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

// AI provider + key config for the selected client. All-clients fallback is the server .env key.
// Admin-only. GET also returns the roster of clients that already have a key.

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

export async function DELETE(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('view');
    const customerId = request.nextUrl.searchParams.get('customerId') ?? undefined;
    return Response.json(await aiSettingsService.remove(scope, customerId));
  } catch (error) {
    return errorResponse(error);
  }
}
