import type { NextRequest } from 'next/server';
import { saveWhatsAppAutoReplySchema } from '@/modules/social/server/whatsapp/auto-reply.schema';
import { autoReplyService } from '@/modules/social/server/whatsapp/auto-reply.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await autoReplyService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const body = saveWhatsAppAutoReplySchema.parse(await request.json());
    return Response.json(await autoReplyService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
