import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { API_PERMISSIONS, apiClientService } from '@/modules/social/server/api-clients/api-client.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json({ permissions: API_PERMISSIONS, clients: await apiClientService.list(organization.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  permissions: z.array(z.string()).min(1),
  dailyLimit: z.number().int().min(1).max(100000).optional(),
  ipAllowlist: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = schema.parse(await request.json());
    return Response.json(await apiClientService.create(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
