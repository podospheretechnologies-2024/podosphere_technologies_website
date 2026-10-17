import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { broadcastService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await broadcastService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

const estimateSchema = z.object({
  action: z.literal('estimate'),
  phones: z.array(z.string()).min(1).max(200),
});

const sendSchema = z.object({
  action: z.literal('send').optional(),
  name: z.string().trim().min(1).max(80),
  templateName: z.string().trim().min(1),
  language: z.string().min(2),
  phones: z.array(z.string()).min(1).max(200),
  variables: z.array(z.string()).max(10).default([]),
  consentAcknowledged: z.literal(true),
});

const bodySchema = z.union([estimateSchema, sendSchema]);

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const body = bodySchema.parse(await request.json());
    if (body.action === 'estimate') {
      return Response.json(await broadcastService.estimate(scope, body.phones));
    }
    return Response.json(await broadcastService.send(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
