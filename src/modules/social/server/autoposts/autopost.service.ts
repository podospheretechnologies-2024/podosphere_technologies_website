import 'server-only';
import type { SocialAutoPost } from '@/generated/prisma/client';
import { HttpError } from '@/shared/server/http-error';
import { AI_MIN_POST_LENGTH } from '../../config/ai';
import { AUTOPOST_DEFAULT_TEMPLATE, AUTOPOST_MAX_ITEMS_PER_RUN } from '../../config/automation';
import { POST_CONTENT_MAX_LENGTH } from '../../config/posts';
import type { AutopostItem, AutopostRunResult } from '../../types/automation';
import { aiService } from '../ai/ai.service';
import { automationQueue } from '../automation/automation.queue';
import { integrationRegistry } from '../integrations/core/integration.registry';
import { integrationRepository } from '../integrations/integration.repository';
import { postService } from '../posts/post.service';
import { autopostRepository } from './autopost.repository';
import type { SaveAutopostBody } from './autopost.schema';
import { fetchFeed, type FeedItem } from './rss-feed';

function toAutopostItem(autopost: SocialAutoPost): AutopostItem {
  return {
    id: autopost.id,
    title: autopost.title,
    url: autopost.url,
    lastUrl: autopost.lastUrl,
    content: autopost.content,
    integrationIds: autopost.integrationIds,
    onSlot: autopost.onSlot,
    syncLast: autopost.syncLast,
    addPicture: autopost.addPicture,
    generateContent: autopost.generateContent,
    active: autopost.active,
    createdAt: autopost.createdAt.toISOString(),
  };
}

async function findOrThrow(organizationId: string, id: string) {
  const autopost = await autopostRepository.findById(organizationId, id);
  if (!autopost) {
    throw new HttpError(404, 'Feed not found');
  }
  return autopost;
}

async function assertChannels(organizationId: string, integrationIds: string[]) {
  const ids = [...new Set(integrationIds)];
  const integrations = await integrationRepository.findManyByIds(organizationId, ids);
  if (integrations.length !== ids.length) {
    throw new HttpError(400, 'One of the selected channels no longer exists');
  }
  return ids;
}

// Checks the link while the user is still in the form, so a typo is reported right away.
async function assertFeed(url: string) {
  const feed = await fetchFeed(url);
  if (feed.items.length === 0) {
    throw new HttpError(400, 'The feed has no items with a link');
  }
}

// Feeds list the newest item first. The first check only remembers where the
// feed is (or posts the newest item with `syncLast`); later checks post what
// was added since, oldest first.
function newItems(autopost: SocialAutoPost, items: FeedItem[]): FeedItem[] {
  if (!autopost.lastUrl) {
    return autopost.syncLast ? items.slice(0, 1) : [];
  }
  const lastIndex = items.findIndex((item) => item.url === autopost.lastUrl);
  // The last handled item dropped out of the feed: only the newest one is posted.
  const fresh = lastIndex === -1 ? items.slice(0, 1) : items.slice(0, lastIndex);
  return fresh.slice(0, AUTOPOST_MAX_ITEMS_PER_RUN).reverse();
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function fillTemplate(template: string, item: FeedItem, maxLength: number): string {
  const filled = template
    .replaceAll('{{title}}', item.title)
    .replaceAll('{{description}}', item.description)
    .replaceAll('{{url}}', item.url)
    .trim();
  if (filled.length <= maxLength || !template.includes('{{url}}')) {
    return truncate(filled, maxLength);
  }

  // Too long: the description gives way first, so the link always stays intact.
  const room = maxLength - (filled.length - item.description.length);
  return fillTemplate(
    template,
    { ...item, description: room > 1 ? truncate(item.description, room) : '' },
    Infinity
  ).slice(0, maxLength);
}

async function writeContent(autopost: SocialAutoPost, item: FeedItem, maxLength: number) {
  const template = autopost.content ?? AUTOPOST_DEFAULT_TEMPLATE;
  const aiLength = maxLength - item.url.length - 2;
  if (
    !autopost.generateContent ||
    !aiService.status().configured ||
    aiLength < AI_MIN_POST_LENGTH
  ) {
    return fillTemplate(template, item, maxLength);
  }

  try {
    const { variations } = await aiService.generatePosts({
      content: [`Title: ${item.title}`, item.description].filter(Boolean).join('\n\n'),
      format: 'post',
      maxLength: aiLength,
    });
    const text = variations[0]?.[0];
    if (text) {
      return `${truncate(text, aiLength)}\n\n${item.url}`;
    }
  } catch (error) {
    console.error(`[social] AI text for feed ${autopost.id} failed, using the template`, error);
  }
  return fillTemplate(template, item, maxLength);
}

async function createPicture(autopost: SocialAutoPost, item: FeedItem): Promise<string[]> {
  if (!autopost.addPicture || !aiService.status().configured) {
    return [];
  }
  try {
    const image = await aiService.generateImage(autopost.organizationId, {
      prompt: [item.title, item.description].filter(Boolean).join('\n\n').slice(0, 1000),
      orientation: 'landscape',
    });
    return [image.id];
  } catch (error) {
    console.error(`[social] AI picture for feed ${autopost.id} failed, posting without it`, error);
    return [];
  }
}

async function runFeed(autopost: SocialAutoPost): Promise<AutopostRunResult> {
  const feed = await fetchFeed(autopost.url);
  const newest = feed.items[0];
  if (!newest) {
    return { created: 0 };
  }

  const items = newItems(autopost, feed.items);
  const integrations = (
    await integrationRepository.findManyByIds(autopost.organizationId, autopost.integrationIds)
  ).filter((integration) => !integration.disabled && !integration.refreshNeeded);

  // Without usable channels the feed still moves on, so old items are not posted later.
  if (items.length === 0 || integrations.length === 0) {
    if (newest.url !== autopost.lastUrl) {
      await autopostRepository.updateLastUrl(autopost.id, newest.url);
    }
    return { created: 0 };
  }

  const maxLength = Math.min(
    ...integrations.map(
      (integration) =>
        integrationRegistry.get(integration.providerIdentifier)?.maxLength() ??
        POST_CONTENT_MAX_LENGTH
    )
  );
  const integrationIds = integrations.map((integration) => integration.id);

  let created = 0;
  for (const item of items) {
    const [content, mediaIds] = await Promise.all([
      writeContent(autopost, item, maxLength),
      createPicture(autopost, item),
    ]);
    const date = autopost.onSlot
      ? await postService.nextFreeSlot(autopost.organizationId, integrationIds)
      : new Date();

    await postService.create(
      autopost.organizationId,
      {
        type: autopost.onSlot ? 'schedule' : 'now',
        date: date.toISOString(),
        tagIds: [],
        posts: integrationIds.map((integrationId) => ({
          integrationId,
          values: [{ content, mediaIds, delay: 0 }],
        })),
      },
      'AUTOPOST'
    );
    // Saved after every post so a failure halfway never posts an item twice.
    await autopostRepository.updateLastUrl(autopost.id, item.url);
    created++;
  }
  return { created };
}

export const autopostService = {
  async list(organizationId: string): Promise<AutopostItem[]> {
    return (await autopostRepository.list(organizationId)).map(toAutopostItem);
  },

  async create(organizationId: string, body: SaveAutopostBody): Promise<AutopostItem> {
    const integrationIds = await assertChannels(organizationId, body.integrationIds);
    await assertFeed(body.url);
    return toAutopostItem(
      await autopostRepository.create(organizationId, { ...body, integrationIds })
    );
  },

  // A new feed link starts over, like a newly added feed.
  async update(organizationId: string, id: string, body: SaveAutopostBody): Promise<AutopostItem> {
    const autopost = await findOrThrow(organizationId, id);
    const integrationIds = await assertChannels(organizationId, body.integrationIds);
    const urlChanged = body.url !== autopost.url;
    if (urlChanged) {
      await assertFeed(body.url);
    }
    return toAutopostItem(
      await autopostRepository.update(id, {
        ...body,
        integrationIds,
        ...(urlChanged ? { lastUrl: null } : {}),
      })
    );
  },

  async remove(organizationId: string, id: string): Promise<void> {
    await findOrThrow(organizationId, id);
    await autopostRepository.softDelete(id);
  },

  // "Check now" button: runs even when the feed is paused.
  async run(organizationId: string, id: string): Promise<AutopostRunResult> {
    return runFeed(await findOrThrow(organizationId, id));
  },

  // Worker job for one feed; feeds paused or deleted since the sweep are skipped.
  async runScheduled(autopostId: string): Promise<AutopostRunResult | 'skipped'> {
    const autopost = await autopostRepository.findActiveById(autopostId);
    return autopost ? runFeed(autopost) : 'skipped';
  },

  async sweep(): Promise<{ queued: number }> {
    const autoposts = await autopostRepository.findAllActive();
    await automationQueue.runAutoposts(autoposts.map((autopost) => autopost.id));
    return { queued: autoposts.length };
  },
};
