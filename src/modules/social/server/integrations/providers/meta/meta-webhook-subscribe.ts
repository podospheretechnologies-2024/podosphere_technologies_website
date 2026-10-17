import 'server-only';
import { getServerEnv } from '@/shared/lib/env';
import { decrypt } from '@/shared/lib/crypto';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

/** Page webhook fields ingested by POST /api/webhooks/meta → inboxService.ingestPageWebhook. */
export const PAGE_WEBHOOK_FIELDS = ['feed', 'messages', 'leadgen'] as const;

/** Instagram webhook fields ingested by the same callback (object=instagram). */
export const INSTAGRAM_WEBHOOK_FIELDS = ['comments', 'messages'] as const;

export type SubscribeResult = {
  ok: boolean;
  target: string;
  detail?: string;
};

type GraphErrorBody = { error?: { message?: string } };

function graphVersion(): string {
  return getServerEnv().META_GRAPH_VERSION;
}

async function appAccessToken(): Promise<string | null> {
  const { META_APP_ID, META_APP_SECRET } = getServerEnv();
  if (!META_APP_ID || !META_APP_SECRET) {
    return null;
  }
  const res = await fetch(
    `https://graph.facebook.com/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&grant_type=client_credentials`
  );
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

/**
 * App-level webhook subscriptions (Meta App Dashboard equivalent via Graph).
 * Points page + Instagram objects at `/api/webhooks/meta`. Missing env → graceful failure.
 */
export async function subscribeAppPageAndInstagramWebhooks(
  callbackUrl?: string
): Promise<SubscribeResult[]> {
  const env = getServerEnv();
  const results: SubscribeResult[] = [];
  const url = callbackUrl ?? `${env.APP_URL.replace(/\/$/, '')}/api/webhooks/meta`;

  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_WEBHOOK_VERIFY_TOKEN) {
    return [
      {
        ok: false,
        target: 'app',
        detail: 'META_APP_ID, META_APP_SECRET and META_WEBHOOK_VERIFY_TOKEN are required',
      },
    ];
  }

  const token = await appAccessToken();
  if (!token) {
    return [{ ok: false, target: 'app', detail: 'Could not obtain Meta app access token' }];
  }

  const objects: { object: string; fields: readonly string[] }[] = [
    { object: 'page', fields: PAGE_WEBHOOK_FIELDS },
    { object: 'instagram', fields: INSTAGRAM_WEBHOOK_FIELDS },
  ];

  for (const { object, fields } of objects) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${graphVersion()}/${env.META_APP_ID}/subscriptions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            object,
            callback_url: url,
            verify_token: env.META_WEBHOOK_VERIFY_TOKEN,
            fields: fields.join(','),
          }),
        }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as GraphErrorBody;
        results.push({
          ok: false,
          target: `app:${object}`,
          detail: body.error?.message ?? `HTTP ${response.status}`,
        });
        continue;
      }
      results.push({ ok: true, target: `app:${object}`, detail: `fields=${fields.join(',')}` });
    } catch (error) {
      results.push({
        ok: false,
        target: `app:${object}`,
        detail: error instanceof Error ? error.message : 'subscribe failed',
      });
    }
  }

  return results;
}

/**
 * Per-Page `/{page-id}/subscribed_apps` so Meta delivers feed/messages/leadgen to the app.
 * Uses the Page access token. Does not throw — returns ok:false on Graph/network errors.
 */
export async function subscribePageApps(
  pageId: string,
  pageAccessToken: string,
  fields: readonly string[] = PAGE_WEBHOOK_FIELDS
): Promise<SubscribeResult> {
  try {
    const params = new URLSearchParams({
      subscribed_fields: fields.join(','),
      access_token: pageAccessToken,
    });
    const response = await fetch(
      `https://graph.facebook.com/${graphVersion()}/${pageId}/subscribed_apps`,
      { method: 'POST', body: params }
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as GraphErrorBody;
      return {
        ok: false,
        target: `page:${pageId}`,
        detail: body.error?.message ?? `HTTP ${response.status}`,
      };
    }
    return { ok: true, target: `page:${pageId}`, detail: `fields=${fields.join(',')}` };
  } catch (error) {
    return {
      ok: false,
      target: `page:${pageId}`,
      detail: error instanceof Error ? error.message : 'subscribe_apps failed',
    };
  }
}

function pageIdForIntegration(integration: {
  providerIdentifier: string;
  internalId: string;
  additionalSettings: unknown;
}): string | null {
  if (integration.providerIdentifier === 'facebook') {
    return integration.internalId;
  }
  if (integration.providerIdentifier === 'instagram') {
    const settings = integration.additionalSettings as { facebookPageId?: string } | null;
    return settings?.facebookPageId ?? null;
  }
  return null;
}

/**
 * Subscribe every Facebook Page (and Instagram-linked Page) in the client scope.
 * Safe without live tokens in CI: each failure is recorded, never thrown.
 */
export async function subscribeScopedMetaPages(scope: ClientScope): Promise<SubscribeResult[]> {
  const integrations = await prisma.socialIntegration.findMany({
    where: {
      ...scopeWhere(scope),
      deletedAt: null,
      providerIdentifier: { in: ['facebook', 'instagram'] },
    },
  });

  const results: SubscribeResult[] = [];
  const seenPages = new Set<string>();

  for (const integration of integrations) {
    const pageId = pageIdForIntegration(integration);
    if (!pageId || seenPages.has(pageId)) {
      continue;
    }
    seenPages.add(pageId);
    let token: string;
    try {
      token = decrypt(integration.accessToken);
    } catch {
      results.push({ ok: false, target: `page:${pageId}`, detail: 'Could not decrypt page token' });
      continue;
    }
    results.push(await subscribePageApps(pageId, token));
  }

  if (results.length === 0) {
    results.push({
      ok: false,
      target: 'pages',
      detail: 'No Facebook or Instagram channels in this workspace to subscribe',
    });
  }

  return results;
}

/** Best-effort subscribe after a Page/IG connect; never throws into the OAuth callback. */
export async function trySubscribePageAfterConnect(
  pageId: string | null | undefined,
  pageAccessToken: string | null | undefined
): Promise<void> {
  if (!pageId || !pageAccessToken) {
    return;
  }
  const result = await subscribePageApps(pageId, pageAccessToken);
  if (!result.ok) {
    console.warn(`[meta] subscribed_apps failed for ${pageId}: ${result.detail}`);
  }
}
