import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { broadcastService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await broadcastService.list(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  templateName: z.string().trim().min(1),
  language: z.string().min(2),
  phones: z.array(z.string()).min(1).max(200),
  variables: z.array(z.string()).max(10).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = schema.parse(await request.json());
    return Response.json(await broadcastService.send(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
