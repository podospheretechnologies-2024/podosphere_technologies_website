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
// Route B: after Social ingest, forward the same raw body + signature to PodoCRM.
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-hub-signature-256');
    whatsappWebhookService.assertSignature(rawBody, signatureHeader);
    const payload = JSON.parse(rawBody) as Parameters<typeof whatsappWebhookService.ingest>[0];
    const result = await whatsappWebhookService.ingest(payload);

    // Do not block Meta's 200 on CRM availability — forward in the background.
    void whatsappWebhookService.forwardToPodoCrm(rawBody, signatureHeader);

    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
