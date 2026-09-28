import 'server-only';
import { integrationRegistry } from '../integrations/core/integration.registry';
import {
  BadBodyError,
  DisconnectError,
  ProviderError,
  RefreshTokenError,
} from '../integrations/core/provider.errors';
import type {
  PublishMedia,
  PublishResult,
  SocialProvider,
} from '../integrations/core/social-provider.interface';
import { integrationRepository } from '../integrations/integration.repository';
import { integrationService } from '../integrations/integration.service';
import { mediaRepository } from '../media/media.repository';
import { readMedia } from '../posts/post.service';
import { getStorage } from '../storage/storage.factory';
import { webhookService } from '../webhooks/webhook.service';
import { publishQueue, type PublishPostJobData } from './publish.queue';
import { publishRepository } from './publish.repository';

// The sweep also queues posts due soon, in case their job was lost (e.g. Redis was flushed).
const SWEEP_LOOKAHEAD_MS = 60 * 60 * 1000;

export type PublishOutcome = 'published' | 'failed' | 'skipped';

type PublishablePost = NonNullable<Awaited<ReturnType<typeof publishRepository.findPost>>>;

// Media is referenced by id so files deleted after scheduling are detected.
async function loadMedia(provider: SocialProvider, post: PublishablePost): Promise<PublishMedia[]> {
  const items = readMedia(post.media);
  if (items.length === 0) {
    return [];
  }

  const rows = await mediaRepository.findManyByIds(
    post.organizationId,
    items.map((item) => item.id)
  );
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const storage = getStorage();

  return items.map((item) => {
    const row = rowById.get(item.id);
    if (!row) {
      throw new BadBodyError(provider.identifier, 'An attached media file was deleted');
    }
    return {
      type: item.type,
      mimeType: row.mimeType ?? 'application/octet-stream',
      alt: item.alt,
      read: () => storage.read(row.name),
    };
  });
}

function blockedReason(post: PublishablePost, provider: SocialProvider | undefined) {
  const { integration } = post;
  if (!provider) {
    return `The ${integration.providerIdentifier} provider is not available`;
  }
  if (integration.deletedAt) {
    return `${integration.name} was removed`;
  }
  if (integration.disabled) {
    return `${integration.name} is disabled`;
  }
  if (integration.refreshNeeded) {
    return `${integration.name} must be reconnected`;
  }
  return null;
}

async function publishToProvider(
  provider: SocialProvider,
  post: PublishablePost
): Promise<PublishResult> {
  const target = {
    internalId: post.integration.internalId,
    accessToken: await integrationService.getAccessToken(post.integration),
  };
  const item = { content: post.content, media: await loadMedia(provider, post) };

  if (!post.parentPostId) {
    return provider.post(target, item);
  }

  const root = await publishRepository.findRoot(post);
  if (!root?.releaseId || !post.parentPost?.releaseId) {
    throw new BadBodyError(provider.identifier, 'The first post of this thread was not published');
  }
  return provider.comment(
    target,
    { rootReleaseId: root.releaseId, parentReleaseId: post.parentPost.releaseId },
    item
  );
}

export const publishService = {
  // Publishes one item of a thread and queues the next one after its delay.
  // Provider errors fail the post right away; unexpected errors (network, ...)
  // are retried by the queue and only fail the post on the last attempt.
  async publish(data: PublishPostJobData, isLastAttempt: boolean): Promise<PublishOutcome> {
    const post = await publishRepository.findPost(data.postId);
    if (!post || post.deletedAt || post.state !== 'QUEUE') {
      return 'skipped';
    }
    if (!post.parentPostId && post.publishDate.toISOString() !== data.publishDate) {
      return 'skipped';
    }
    if (post.parentPostId && post.parentPost?.state !== 'PUBLISHED') {
      return 'skipped';
    }

    const provider = integrationRegistry.get(post.integration.providerIdentifier);
    const blocked = blockedReason(post, provider);
    if (blocked || !provider) {
      await publishRepository.markFailed(post, {
        platform: post.integration.providerIdentifier,
        message: blocked ?? 'Unknown provider',
      });
      return 'failed';
    }

    let result: PublishResult;
    try {
      result = await publishToProvider(provider, post);
    } catch (error) {
      if (error instanceof RefreshTokenError || error instanceof DisconnectError) {
        await integrationRepository.markRefreshNeeded(post.integration.id);
      }
      if (!(error instanceof ProviderError) && !isLastAttempt) {
        throw error;
      }

      await publishRepository.markFailed(post, {
        platform: provider.identifier,
        message:
          error instanceof ProviderError ? error.message : `Could not publish to ${provider.name}`,
        body: error instanceof ProviderError ? error.body : String(error),
      });
      return 'failed';
    }

    await publishRepository.markPublished(post.id, result);
    if (!post.parentPostId) {
      await webhookService.queuePublished(post.integration.id, post.id);
    }

    const next = await publishRepository.findNext(post.id);
    if (next) {
      await publishQueue.schedule([
        {
          postId: next.id,
          publishDate: next.publishDate,
          runAt: new Date(Date.now() + next.delay * 60 * 1000),
        },
      ]);
    }
    return 'published';
  },

  // Safety net for jobs that never ran: worker downtime, lost Redis data or a
  // crash between publishing an item and queueing the next one.
  async sweep(): Promise<{ queued: number }> {
    const [roots, comments] = await Promise.all([
      publishRepository.findDueRoots(new Date(Date.now() + SWEEP_LOOKAHEAD_MS)),
      publishRepository.findPendingComments(),
    ]);

    const jobs = [
      ...roots.map((post) => ({
        postId: post.id,
        publishDate: post.publishDate,
        runAt: post.publishDate,
      })),
      ...comments.map((post) => ({
        postId: post.id,
        publishDate: post.publishDate,
        runAt: new Date(post.parentPost!.updatedAt.getTime() + post.delay * 60 * 1000),
      })),
    ];

    await publishQueue.schedule(jobs, { replace: false });
    return { queued: jobs.length };
  },
};
