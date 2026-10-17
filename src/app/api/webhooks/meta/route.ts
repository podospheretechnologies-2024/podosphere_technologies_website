import type { NextRequest } from 'next/server';
import { whatsappWebhookService } from '@/modules/social/server/whatsapp/whatsapp-webhook.service';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { errorResponse } from '@/shared/server/http-error';

/**
 * Meta Page + Instagram webhooks (App Review).
 *
 * Configure in Meta App Dashboard (or POST /api/social/meta/webhooks):
 * - object `page` fields: feed, messages, leadgen → callback this URL
 * - object `instagram` fields: comments, messages → callback this URL
 * - Per Page: Graph `POST /{page-id}/subscribed_apps` with subscribed_fields
 *
 * WhatsApp Cloud API uses /api/webhooks/whatsapp instead.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const challenge = whatsappWebhookService.verify(
      params.get('hub.mode'),
      params.get('hub.verify_token'),
      params.get('hub.challenge')
    );
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    whatsappWebhookService.assertSignature(rawBody, request.headers.get('x-hub-signature-256'));
    const payload = JSON.parse(rawBody) as Parameters<typeof inboxService.ingestPageWebhook>[0];
    // ingestPageWebhook accepts object=page | object=instagram (messages, feed/comments, leadgen).
    const result = await inboxService.ingestPageWebhook(payload);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
