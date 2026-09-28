import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma, SocialPostState } from '@/generated/prisma/client';
import { HttpError } from '@/shared/server/http-error';
import { POST_CONTENT_MAX_LENGTH, POSTS_PAGE_SIZE } from '../../config/posts';
import type {
  PostChannel,
  PostGroup,
  PostListPage,
  PostMedia,
  PostState,
  PostThreadItem,
} from '../../types/post';
import { integrationRegistry } from '../integrations/core/integration.registry';
import { integrationRepository } from '../integrations/integration.repository';
import { mediaRepository } from '../media/media.repository';
import { postRepository, type CreateGroupData } from './post.repository';
import type { ListPostsQuery, SavePostBody } from './post.schema';

// Small tolerance so a post scheduled for "right now" is not rejected by clock drift.
const PAST_DATE_TOLERANCE_MS = 60 * 1000;

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

function readMedia(value: Prisma.JsonValue): PostMedia[] {
  return Array.isArray(value) ? (value as unknown as PostMedia[]) : [];
}

function toThreadItem(row: PostRow): PostThreadItem {
  return { content: row.content, media: readMedia(row.media), delay: row.delay };
}

// Rebuilds each channel's thread by walking the parent -> child chain.
function toPostGroup(group: string, rows: PostRow[]): PostGroup {
  const childByParent = new Map(
    rows.filter((row) => row.parentPostId).map((row) => [row.parentPostId, row])
  );
  const roots = rows.filter((row) => !row.parentPostId);

  return {
    group,
    state: toPostState(roots[0].state),
    publishDate: roots[0].publishDate.toISOString(),
    posts: roots.map((root) => {
      const values: PostThreadItem[] = [];
      for (let row: PostRow | undefined = root; row; row = childByParent.get(row.id)) {
        values.push(toThreadItem(row));
      }
      return { channel: toChannel(root.integration), values };
    }),
  };
}

async function buildGroupData(
  organizationId: string,
  group: string,
  body: SavePostBody
): Promise<CreateGroupData> {
  const isDraft = body.type === 'draft';
  const publishDate = body.type === 'now' ? new Date() : new Date(body.date);

  if (body.type === 'schedule' && publishDate.getTime() < Date.now() - PAST_DATE_TOLERANCE_MS) {
    throw new HttpError(400, 'Pick a date and time in the future');
  }

  const integrationIds = body.posts.map((post) => post.integrationId);
  const integrations = await integrationRepository.findManyByIds(organizationId, integrationIds);
  const integrationById = new Map(integrations.map((integration) => [integration.id, integration]));

  const mediaIds = [
    ...new Set(body.posts.flatMap((post) => post.values.flatMap((value) => value.mediaIds))),
  ];
  const media = mediaIds.length
    ? await mediaRepository.findManyByIds(organizationId, mediaIds)
    : [];
  const mediaById = new Map<string, PostMedia>(
    media.map((item) => [
      item.id,
      {
        id: item.id,
        url: item.path,
        type: item.type === 'VIDEO' ? 'video' : 'image',
        alt: item.alt,
      },
    ])
  );
  if (mediaById.size !== mediaIds.length) {
    throw new HttpError(400, 'Some attached media files no longer exist');
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

    return { integrationId: integration.id, values };
  });

  return {
    organizationId,
    group,
    state: isDraft ? 'DRAFT' : 'QUEUE',
    publishDate,
    threads,
  };
}

async function findGroupOrThrow(organizationId: string, group: string) {
  const rows = await postRepository.findGroup(organizationId, group);
  if (rows.length === 0) {
    throw new HttpError(404, 'Post not found');
  }
  return rows;
}

export const postService = {
  async list(organizationId: string, query: ListPostsQuery): Promise<PostListPage> {
    const { total, results } = await postRepository.list(organizationId, query.page, query.state);
    const comments = await postRepository.countComments(organizationId, [
      ...new Set(results.map((post) => post.group)),
    ]);

    return {
      page: query.page,
      pages: Math.ceil(total / POSTS_PAGE_SIZE),
      total,
      results: results.map((post) => ({
        id: post.id,
        group: post.group,
        state: toPostState(post.state),
        publishDate: post.publishDate.toISOString(),
        content: post.content,
        media: readMedia(post.media),
        commentsCount: comments.get(`${post.group}:${post.integrationId}`) ?? 0,
        releaseUrl: post.releaseUrl,
        error: post.error,
        channel: toChannel(post.integration),
      })),
    };
  },

  async getGroup(organizationId: string, group: string): Promise<PostGroup> {
    return toPostGroup(group, await findGroupOrThrow(organizationId, group));
  },

  // All channels picked in one composer submission share a group id, so they
  // can be edited, moved and deleted together.
  async create(organizationId: string, body: SavePostBody): Promise<{ group: string }> {
    const group = randomUUID();
    await postRepository.createGroup(await buildGroupData(organizationId, group, body));
    return { group };
  },

  async update(
    organizationId: string,
    group: string,
    body: SavePostBody
  ): Promise<{ group: string }> {
    const rows = await findGroupOrThrow(organizationId, group);
    if (rows.some((row) => row.state === 'PUBLISHED')) {
      throw new HttpError(409, 'Published posts cannot be edited');
    }
    await postRepository.replaceGroup(await buildGroupData(organizationId, group, body));
    return { group };
  },

  async remove(organizationId: string, group: string): Promise<void> {
    const deleted = await postRepository.softDeleteGroup(organizationId, group);
    if (deleted === 0) {
      throw new HttpError(404, 'Post not found');
    }
  },
};
