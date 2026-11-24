import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { integrationService } from '@/modules/social/server/integrations/integration.service';
import { requireRole } from '@/shared/server/access';
import { getCurrentOrganizationOrClient } from '@/shared/server/current-organization-or-client';
import { errorResponse, HttpError } from '@/shared/server/http-error';

const saveSchema = z.object({
  internalIds: z.array(z.string().min(1).max(64)).max(100),
  /** Client for the new Pages; null = Unassigned (admin-only). Omit to use the switcher client. */
  customerId: z.string().min(1).max(64).nullable().optional(),
});

// Page picker after Meta OAuth (PS-01). Agency OWNER/ADMIN only.
export async function GET() {
  try {
    await requireRole('ADMIN');
    const { organization } = await getCurrentOrganizationOrClient();
    const pending = await integrationService.listPendingPages(organization.id);
    if (!pending) throw new HttpError(404, 'No Pages waiting. Connect again to pick Pages.');
    return Response.json(pending);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const { organization } = await getCurrentOrganizationOrClient();
    const body = saveSchema.parse(await request.json());
    const { integrations } = await integrationService.savePendingPages(organization.id, body);
    return Response.json({ connected: integrations.map((row) => ({ id: row.id, name: row.name })) });
  } catch (error) {
    return errorResponse(error);
  }
}
