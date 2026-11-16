import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    const [connection, connections] = await Promise.all([
      whatsappOnboardingService.connection(scope),
      whatsappOnboardingService.listConnections(scope.organizationId),
    ]);
    return Response.json({
      ...whatsappOnboardingService.config(),
      connection,
      connections,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const completeSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  displayPhone: z.string().optional(),
  businessName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('inbox');
    const body = completeSchema.parse(await request.json());
    return Response.json(await whatsappOnboardingService.completeSignup(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}

const assignSchema = z.object({
  connectionId: z.string().min(1),
  customerId: z.string().min(1).nullable(),
});

/** Assign a connected number to a client (or null = agency-shared). */
export async function PATCH(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('inbox');
    const body = assignSchema.parse(await request.json());
    const connections = await whatsappOnboardingService.assignConnection(
      scope.organizationId,
      body.connectionId,
      body.customerId
    );
    return Response.json({ connections });
  } catch (error) {
    return errorResponse(error);
  }
}
