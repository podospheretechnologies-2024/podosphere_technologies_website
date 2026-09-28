import 'server-only';
import { HttpError } from '@/shared/server/http-error';
import { assertPublicUrl, fetchPublicUrl } from '@/shared/server/public-fetch';
import type { WebhookItem, WebhookTestResult } from '../../types/automation';
import { automationQueue, type SendWebhookJobData } from '../automation/automation.queue';
import { integrationRepository } from '../integrations/integration.repository';
import { webhookRepository } from './webhook.repository';
import type { SaveWebhookBody } from './webhook.schema';

type WebhookRow = NonNullable<Awaited<ReturnType<typeof webhookRepository.findById>>>;

interface WebhookPayload {
  event: 'post.published' | 'webhook.test';
  sentAt: string;
  post: {
    id: string;
    group: string;
    content: string;
    publishDate: string;
    releaseUrl: string | null;
    channel: { id: string; name: string; providerIdentifier: string };
  };
}

function toWebhookItem(webhook: WebhookRow): WebhookItem {
  return {
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    integrationIds: webhook.integrations.map((link) => link.integrationId),
    createdAt: webhook.createdAt.toISOString(),
  };
}

async function findOrThrow(organizationId: string, id: string) {
  const webhook = await webhookRepository.findById(organizationId, id);
  if (!webhook) {
    throw new HttpError(404, 'Webhook not found');
  }
  return webhook;
}

async function assertChannels(organizationId: string, integrationIds: string[]) {
  const ids = [...new Set(integrationIds)];
  const integrations = await integrationRepository.findManyByIds(organizationId, ids);
  if (integrations.length !== ids.length) {
    throw new HttpError(400, 'One of the selected channels no longer exists');
  }
  return ids;
}

// Redirects are not followed: a webhook must answer at the address it was saved with.
async function deliver(url: string, payload: WebhookPayload): Promise<number> {
  const { response } = await fetchPublicUrl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    maxRedirects: 0,
  });
  await response.body?.cancel();
  return response.status;
}

export const webhookService = {
  async list(organizationId: string): Promise<WebhookItem[]> {
    return (await webhookRepository.list(organizationId)).map(toWebhookItem);
  },

  async create(organizationId: string, body: SaveWebhookBody): Promise<WebhookItem> {
    const integrationIds = await assertChannels(organizationId, body.integrationIds);
    await assertPublicUrl(new URL(body.url));
    return toWebhookItem(
      await webhookRepository.create(organizationId, { ...body, integrationIds })
    );
  },

  async update(organizationId: string, id: string, body: SaveWebhookBody): Promise<WebhookItem> {
    await findOrThrow(organizationId, id);
    const integrationIds = await assertChannels(organizationId, body.integrationIds);
    await assertPublicUrl(new URL(body.url));
    return toWebhookItem(await webhookRepository.update(id, { ...body, integrationIds }));
  },

  async remove(organizationId: string, id: string): Promise<void> {
    await findOrThrow(organizationId, id);
    await webhookRepository.softDelete(id);
  },

  // Sends a sample payload right away so the user can check their endpoint.
  async test(organizationId: string, id: string): Promise<WebhookTestResult> {
    const webhook = await findOrThrow(organizationId, id);
    const now = new Date().toISOString();
    const status = await deliver(webhook.url, {
      event: 'webhook.test',
      sentAt: now,
      post: {
        id: 'test',
        group: 'test',
        content: 'This is a test message from Podosphere.',
        publishDate: now,
        releaseUrl: null,
        channel: { id: 'test', name: 'Test channel', providerIdentifier: 'test' },
      },
    });
    return { status };
  },

  // Called by the publish worker; failures are logged so publishing never breaks.
  async queuePublished(integrationId: string, postId: string): Promise<void> {
    try {
      const webhooks = await webhookRepository.findForIntegration(integrationId);
      await automationQueue.sendWebhooks(
        webhooks.map((webhook) => webhook.id),
        postId
      );
    } catch (error) {
      console.error(`[social] could not queue webhooks for post ${postId}`, error);
    }
  },

  // Runs in the worker. A non-2xx answer throws so the queue retries it.
  async send({ webhookId, postId }: SendWebhookJobData): Promise<{ status: number } | 'skipped'> {
    const [webhook, post] = await Promise.all([
      webhookRepository.findActiveById(webhookId),
      webhookRepository.findPublishedPost(postId),
    ]);
    if (!webhook || !post) {
      return 'skipped';
    }

    const status = await deliver(webhook.url, {
      event: 'post.published',
      sentAt: new Date().toISOString(),
      post: {
        id: post.id,
        group: post.group,
        content: post.content,
        publishDate: post.publishDate.toISOString(),
        releaseUrl: post.releaseUrl,
        channel: post.integration,
      },
    });
    if (status < 200 || status >= 300) {
      throw new Error(`Webhook ${webhook.name} answered with HTTP ${status}`);
    }
    return { status };
  },
};
