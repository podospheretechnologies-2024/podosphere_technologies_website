import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma, SocialCreationMethod, SocialPostState } from '@/generated/prisma/client';
import { HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import type { ClientScope } from '@/shared/server/client-scope';
import { organizationScope } from '@/shared/server/client-scope';
import { CALENDAR_MAX_RANGE_DAYS } from '../../config/calendar';
import { POST_CONTENT_MAX_LENGTH, POSTS_PAGE_SIZE } from '../../config/posts';
import type {
  PostChannel,
  PostGroup,
  PostListItem,
  PostListPage,
  PostMedia,
  PostState,
  PostThreadItem,
} from '../../types/post';
import type { TagItem } from '../../types/settings';
import { integrationRegistry } from '../integrations/core/integration.registry';
import { integrationRepository } from '../integrations/integration.repository';
import { mediaRepository } from '../media/media.repository';
import { publishQueue } from '../publishing/publish.queue';
import { tagRepository } from '../tags/tag.repository';
import { toTagItem } from '../tags/tag.service';
import { postRepository, type CreateGroupData } from './post.repository';
import type {
  CalendarQuery,
  ListPostsQuery,
  ReschedulePostBody,
  SavePostBody,
} from './post.schema';
import { recurrenceService } from './recurrence.service';

// Small tolerance so a post scheduled for "right now" is not rejected by clock drift.
const PAST_DATE_TOLERANCE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FREE_SLOT_SEARCH_DAYS = 30;
const DEFAULT_POSTING_TIMES = [120, 400, 700];

function readPostingTimes(value: Prisma.JsonValue): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const time = (entry as { time?: unknown } | null)?.time;
    return typeof time === 'number' && time >= 0 && time < 24 * 60 ? [time] : [];
  });
}

type PostRow = Awaited<ReturnType<typeof postRepository.findGroup>>[number];

function toPostState(state: SocialPostState): PostState {
  return state.toLowerCase() as PostState;
}

function toChannel(integration: PostRow['integration']): PostChannel {
  return {
    id: integration.id,
    name: integration.name,
    picture: integration.picture,
    providerIdentifier: integration.providerIdentifier,
    providerName:
      integrationRegistry.get(integration.providerIdentifier)?.name ??
      integration.providerIdentifier,
  };
}

function toTags(row: PostRow): TagItem[] {
  return row.tags.map(({ tag }) => toTagItem(tag));
}

export function readMedia(value: Prisma.JsonValue): PostMedia[] {
  return Array.isArray(value) ? (value as unknown as PostMedia[]) : [];
}

function toThreadItem(row: PostRow): PostThreadItem {
  return { content: row.content, media: readMedia(row.media), delay: row.delay };
}

// Rebuilds each channel's thread by walking the parent -> child chain.
function toPostGroup(
  group: string,
  rows: PostRow[],
  recurrence: Awaited<ReturnType<typeof recurrenceService.getForGroup>>
): PostGroup {
  const childByParent = new Map(
    rows.filter((row) => row.parentPostId).map((row) => [row.parentPostId, row])
  );
  const roots = rows.filter((row) => !row.parentPostId);

  return {
    group,
    state: toPostState(roots[0].state),
    publishDate: roots[0].publishDate.toISOString(),
    tags: toTags(roots[0]),
    recurrence,
    posts: roots.map((root) => {
      const values: PostThreadItem[] = [];
      for (let row: PostRow | undefined = root; row; row = childByParent.get(row.id)) {
        values.push(toThreadItem(row));
      }
      return {
        channel: toChannel(root.integration),
        firstComment: root.firstComment,
        values,
      };
    }),
  };
}

async function buildGroupData(
  scope: ClientScope,
  group: string,
  body: SavePostBody,
  creationMethod: SocialCreationMethod
): Promise<CreateGroupData> {
  const organizationId = scope.organizationId;
  const isDraft = body.type === 'draft';
  const publishDate = body.type === 'now' ? new Date() : new Date(body.date);

  if (body.type === 'schedule' && publishDate.getTime() < Date.now() - PAST_DATE_TOLERANCE_MS) {
    throw new HttpError(400, 'Pick a date and time in the future');
  }

  const integrationIds = body.posts.map((post) => post.integrationId);
  const integrations = await integrationRepository.findManyByIds(organizationId, integrationIds);
  assertChannelsInScope(scope, integrations);
  const integrationById = new Map(integrations.map((integration) => [integration.id, integration]));

  const mediaIds = [
    ...new Set(body.posts.flatMap((post) => post.values.flatMap((value) => value.mediaIds))),
  ];
  const media = mediaIds.length
    ? await mediaRepository.findManyByIds(organizationId, mediaIds)
    : [];
  // Shared agency media (customerId null) is allowed; client-owned media must be in scope.
  const mediaInScope = media.filter((item) => {
    if (scope.customerIds === 'all') return true;
    if (item.customerId == null) return true;
    return scope.customerIds.includes(item.customerId);
  });
  const mediaById = new Map<string, PostMedia>(
    mediaInScope.map((item) => [
      item.id,
      {
        id: item.id,
        url: item.path,
        type: item.type === 'VIDEO' ? 'video' : 'image',
        format: item.format === 'REEL' ? 'reel' : item.format === 'STORY' ? 'story' : 'post',
        alt: item.alt,
      },
    ])
  );
  if (mediaById.size !== mediaIds.length) {
    throw new HttpError(400, 'Some attached media files no longer exist');
  }

  const tagIds = [...new Set(body.tagIds)];
  const tags = tagIds.length ? await tagRepository.findManyByIds(organizationId, tagIds) : [];
  if (tags.length !== tagIds.length) {
    throw new HttpError(400, 'Some selected tags no longer exist');
  }

  const threads = body.posts.map((post) => {
    const integration = integrationById.get(post.integrationId);
    if (!integration) {
      throw new HttpError(400, 'One of the selected channels no longer exists');
    }
    if (!isDraft && integration.disabled) {
      throw new HttpError(400, `${integration.name} is disabled. Enable it or remove it.`);
    }
    if (!isDraft && integration.refreshNeeded) {
      throw new HttpError(400, `${integration.name} must be reconnected before posting`);
    }

    const maxLength =
      integrationRegistry.get(integration.providerIdentifier)?.maxLength() ??
      POST_CONTENT_MAX_LENGTH;

    const firstComment = post.firstComment?.trim() || null;
    if (firstComment && !isDraft && firstComment.length > maxLength) {
      throw new HttpError(
        400,
        `${integration.name}: first comment can be at most ${maxLength} characters (${firstComment.length} used)`
      );
    }

    const values = post.values.map((value, index) => {
      const content = value.content.trim();
      if (!content && value.mediaIds.length === 0) {
        throw new HttpError(
          400,
          index === 0 ? 'Write something or attach media' : `Comment ${index} is empty`
        );
      }
      if (!isDraft && content.length > maxLength) {
        throw new HttpError(
          400,
          `${integration.name}: posts can be at most ${maxLength} characters (${content.length} used)`
        );
      }
      return {
        content,
        media: value.mediaIds.map((id) => mediaById.get(id)!),
        delay: index === 0 ? 0 : value.delay,
      };
    });

    return { integrationId: integration.id, firstComment, values };
  });

  return {
    organizationId,
    group,
    state: isDraft ? 'DRAFT' : 'QUEUE',
    publishDate,
    tagIds,
    creationMethod,
    threads,
  };
}

async function findGroupOrThrow(scope: ClientScope, group: string) {
  const rows = await postRepository.findGroup(scope, group);
  if (rows.length === 0) {
    throw new HttpError(404, 'Post not found');
  }
  return rows;
}

function assertChannelsInScope(
  scope: ClientScope,
  integrations: { id: string; customerId: string | null }[]
) {
  if (scope.customerIds === 'all') return;
  for (const integration of integrations) {
    if (!integration.customerId || !scope.customerIds.includes(integration.customerId)) {
      throw new HttpError(404, 'Not found');
    }
  }
}

// Queues the first post of every channel; comments are queued by the worker
// once the item before them is published. The save itself already succeeded,
// so a queue outage is only logged: the worker's sweep picks the posts up later.
async function queueForPublishing(organizationId: string, group: string) {
  const rows = await postRepository.findGroup(organizationScope(organizationId), group);
  const jobs = rows
    .filter((row) => !row.parentPostId && row.state === 'QUEUE')
    .map((row) => ({ postId: row.id, publishDate: row.publishDate, runAt: row.publishDate }));

  try {
    await publishQueue.schedule(jobs);
  } catch (error) {
    console.error(`[social] could not queue post group ${group}`, error);
  }
}

async function toListItems(organizationId: string, posts: PostRow[]): Promise<PostListItem[]> {
  const comments = await postRepository.countComments(organizationId, [
    ...new Set(posts.map((post) => post.group)),
  ]);

  return posts.map((post) => ({
    id: post.id,
    group: post.group,
    state: toPostState(post.state),
    approvalStep: post.approvalStep,
    customerId: post.customerId,
    publishDate: post.publishDate.toISOString(),
    content: post.content,
    media: readMedia(post.media),
    commentsCount: comments.get(`${post.group}:${post.integrationId}`) ?? 0,
    releaseUrl: post.releaseUrl,
    error: post.error,
    channel: toChannel(post.integration),
    tags: toTags(post),
  }));
}

export const postService = {
  async list(scope: ClientScope, query: ListPostsQuery): Promise<PostListPage> {
    const { total, results } = await postRepository.list(scope, query.page, query.state);

    return {
      page: query.page,
      pages: Math.ceil(total / POSTS_PAGE_SIZE),
      total,
      results: await toListItems(scope.organizationId, results),
    };
  },

  async listRange(scope: ClientScope, query: CalendarQuery): Promise<PostListItem[]> {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    if (end <= start) {
      throw new HttpError(400, 'endDate must be after startDate');
    }
    if (end.getTime() - start.getTime() > CALENDAR_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      throw new HttpError(400, `The date range can be at most ${CALENDAR_MAX_RANGE_DAYS} days`);
    }

    return toListItems(scope.organizationId, await postRepository.listRange(scope, start, end));
  },

  // Moves every channel of the group to the new date. A failed post is queued
  // again; drafts stay drafts.
  async reschedule(scope: ClientScope, group: string, body: ReschedulePostBody): Promise<void> {
    const rows = await findGroupOrThrow(scope, group);
    if (rows.some((row) => row.state === 'PUBLISHED')) {
      throw new HttpError(409, 'Published posts cannot be moved');
    }

    const date = new Date(body.date);
    const isDraft = rows.every((row) => row.state === 'DRAFT');
    if (!isDraft && date.getTime() < Date.now() - PAST_DATE_TOLERANCE_MS) {
      throw new HttpError(400, 'Posts can only be moved to a future date');
    }

    await postRepository.reschedule(scope, group, date);
    await queueForPublishing(scope.organizationId, group);
    
    await logAudit({
      action: 'post.reschedule',
      targetType: 'post_group',
      targetId: group,
      metadata: { date: body.date }
    });
  },

  // First posting time of the channels (minutes after midnight UTC) that none
  // of them already uses, so automatic posts do not pile up at the same moment.
  async nextFreeSlot(organizationId: string, integrationIds: string[]): Promise<Date> {
    const integrations = await integrationRepository.findManyByIds(organizationId, integrationIds);
    const configured = integrations.flatMap((integration) =>
      readPostingTimes(integration.postingTimes)
    );
    const times = [...new Set(configured.length ? configured : DEFAULT_POSTING_TIMES)].sort(
      (a, b) => a - b
    );

    const now = Date.now();
    const end = new Date(now + FREE_SLOT_SEARCH_DAYS * DAY_MS);
    const taken = new Set(
      (await postRepository.findTakenDates(organizationId, integrationIds, new Date(now), end)).map(
        (date) => date.getTime()
      )
    );

    const today = new Date(now);
    const startOfDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    for (let day = 0; day <= FREE_SLOT_SEARCH_DAYS; day++) {
      for (const time of times) {
        const slot = startOfDay + day * DAY_MS + time * 60 * 1000;
        if (slot > now && !taken.has(slot)) {
          return new Date(slot);
        }
      }
    }
    return end;
  },

  async getGroup(scope: ClientScope, group: string): Promise<PostGroup> {
    const rows = await findGroupOrThrow(scope, group);
    return toPostGroup(group, rows, await recurrenceService.getForGroup(group));
  },

  // All channels picked in one composer submission share a group id, so they
  // can be edited, moved and deleted together.
  async create(
    scope: ClientScope,
    body: SavePostBody,
    creationMethod: SocialCreationMethod = 'WEB'
  ): Promise<{ group: string }> {
    const group = randomUUID();
    await postRepository.createGroup(
      await buildGroupData(scope, group, body, creationMethod)
    );
    await recurrenceService.saveForGroup(scope.organizationId, group, body.recurrence);
    await queueForPublishing(scope.organizationId, group);

    await logAudit({
      action: 'post.create',
      targetType: 'post_group',
      targetId: group,
      metadata: { state: body.type, creationMethod, recurrence: body.recurrence?.rule ?? null },
    });

    return { group };
  },

  async update(
    scope: ClientScope,
    group: string,
    body: SavePostBody
  ): Promise<{ group: string }> {
    const rows = await findGroupOrThrow(scope, group);
    if (rows.some((row) => row.state === 'PUBLISHED')) {
      throw new HttpError(409, 'Published posts cannot be edited');
    }
    await postRepository.replaceGroup(
      await buildGroupData(scope, group, body, rows[0].creationMethod)
    );
    await recurrenceService.saveForGroup(scope.organizationId, group, body.recurrence);
    await queueForPublishing(scope.organizationId, group);

    await logAudit({
      action: 'post.update',
      targetType: 'post_group',
      targetId: group,
      metadata: { state: body.type, recurrence: body.recurrence?.rule ?? null },
    });

    return { group };
  },

  async remove(scope: ClientScope, group: string): Promise<void> {
    const deleted = await postRepository.softDeleteGroup(scope, group);
    if (deleted === 0) {
      throw new HttpError(404, 'Post not found');
    }
    await recurrenceService.deactivateForGroup(group);

    await logAudit({
      action: 'post.remove',
      targetType: 'post_group',
      targetId: group,
    });
  },
};
