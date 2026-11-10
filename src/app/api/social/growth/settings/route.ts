import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { settingsSchema } from '@/modules/social/server/growth/growth.schema';
import { getSettings, updateSettings } from '@/modules/social/server/growth/growth.service';

export async function GET() {
  try {
    const { gc } = await growthRequest('view');
    return Response.json(await getSettings(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { gc } = await growthRequest('approve');
    const input = settingsSchema.parse(await request.json());
    return Response.json(
      await updateSettings(gc, {
        ...input,
        contentSheetUrl: input.contentSheetUrl ?? undefined,
        brandContext: input.brandContext ?? undefined,
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}
