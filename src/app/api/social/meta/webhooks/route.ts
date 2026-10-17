import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  subscribeAppPageAndInstagramWebhooks,
  subscribeScopedMetaPages,
} from '@/modules/social/server/integrations/providers/meta/meta-webhook-subscribe';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

const bodySchema = z
  .object({
    /** Override callback URL (defaults to `${APP_URL}/api/webhooks/meta`). */
    webhookUrl: z.string().url().optional(),
    /** When true, also call Graph `/{page-id}/subscribed_apps` for channels in scope. */
    subscribePages: z.boolean().optional().default(true),
  })
  .optional();

/**
 * Subscribe Meta Page + Instagram webhooks to POST /api/webhooks/meta.
 *
 * - App-level: POST /{app-id}/subscriptions for objects `page` and `instagram`
 * - Page-level: POST /{page-id}/subscribed_apps for each connected Page
 *
 * Mirrors WhatsApp's POST /api/social/whatsapp/settings webhook configure.
 * Missing Meta tokens/env return ok:false entries — does not fail CI hard.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json) ?? { subscribePages: true };

    const app = await subscribeAppPageAndInstagramWebhooks(body.webhookUrl);
    const pages = body.subscribePages !== false ? await subscribeScopedMetaPages(scope) : [];

    return Response.json({
      callback: body.webhookUrl ?? null,
      app,
      pages,
      ok: [...app, ...pages].some((r) => r.ok),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
