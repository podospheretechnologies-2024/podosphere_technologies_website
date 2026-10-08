import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiKey } from '@/modules/social/server/api-clients/api-client.service';
import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { errorResponse } from '@/shared/server/http-error';

const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), to: z.string().min(8), text: z.string().min(1) }),
  z.object({
    type: z.literal('template'),
    to: z.string().min(8),
    templateName: z.string().min(1),
    language: z.string().min(2),
    variables: z.array(z.string()).default([]),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    return await withApiKey('whatsapp:send', request, async ({ organizationId }) => {
      const body = schema.parse(await request.json());
      const result = await whatsappService.send(organizationId, body);
      return Response.json(result);
    });
  } catch (error) {
    return errorResponse(error);
  }
}
