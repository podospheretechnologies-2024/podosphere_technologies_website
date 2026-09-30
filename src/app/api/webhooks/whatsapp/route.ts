import type { NextRequest } from 'next/server';
import { whatsappWebhookService } from '@/modules/social/server/whatsapp/whatsapp-webhook.service';
import { errorResponse } from '@/shared/server/http-error';

// Meta webhook verification handshake.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const challenge = whatsappWebhookService.verify(
      params.get('hub.mode'),
      params.get('hub.verify_token'),
      params.get('hub.challenge')
    );
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// Inbound WhatsApp messages for the business number.
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    whatsappWebhookService.assertSignature(rawBody, request.headers.get('x-hub-signature-256'));
    const payload = JSON.parse(rawBody) as Parameters<typeof whatsappWebhookService.ingest>[0];
    const result = await whatsappWebhookService.ingest(payload);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
