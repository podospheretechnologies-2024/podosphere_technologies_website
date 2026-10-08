import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { billingService } from '@/modules/social/server/billing/billing.service';
import { isPlanKey } from '@/modules/social/config/plans';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await billingService.status(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

const schema = z.object({ plan: z.string() });

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = schema.parse(await request.json());
    if (!isPlanKey(body.plan)) {
      throw new HttpError(400, 'Unknown plan');
    }
    return Response.json(await billingService.createOrder(organization.id, body.plan));
  } catch (error) {
    return errorResponse(error);
  }
}
