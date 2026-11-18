import type { NextRequest } from 'next/server';
import { shopifyWebhookService } from '@/modules/social/server/shopify/shopify-webhook.service';
import { errorResponse } from '@/shared/server/http-error';

/**
 * Shopify order / checkout webhooks for WhatsApp order flows.
 * Register topics from SHOPIFY_ORDER_FLOW_TOPICS on the connected store.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    // Process inline but return quickly — Shopify expects 200 within ~5s.
    const result = await shopifyWebhookService.ingest({
      rawBody,
      shopDomainHeader: request.headers.get('x-shopify-shop-domain'),
      hmacHeader: request.headers.get('x-shopify-hmac-sha256'),
      topicHeader: request.headers.get('x-shopify-topic'),
      webhookIdHeader: request.headers.get('x-shopify-webhook-id'),
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
