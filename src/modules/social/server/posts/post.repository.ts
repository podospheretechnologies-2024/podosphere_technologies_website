import 'server-only';
import type { Prisma, SocialPostState } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { POSTS_PAGE_SIZE, type PostListFilter } from '../../config/posts';
import type { PostMedia } from '../../types/post';

const channelSelect = {
  id: true,
  name: true,
  picture: true,
  providerIdentifier: true,
} satisfies Prisma.SocialIntegrationSelect;

export interface CreateThreadData {
  integrationId: string;
  values: { content: string; media: PostMedia[]; delay: number }[];
}

export interface CreateGroupData {
  organizationId: string;
  group: string;
  state: SocialPostState;
  publishDate: Date;
  threads: CreateThreadData[];
}

function listFilter(filter: PostListFilter): {
  where: Prisma.SocialPostWhereInput;
  orderBy: Prisma.SortOrder;
} {
  switch (filter) {
    case 'scheduled':
      return { where: { state: 'QUEUE' }, orderBy: 'asc' };
    case 'draft':
      return { where: { state: 'DRAFT' }, orderBy: 'asc' };
    case 'published':
      return { where: { state: 'PUBLISHED' }, orderBy: 'desc' };
    case 'error':
      return { where: { state: 'ERROR' }, orderBy: 'desc' };
    case 'all':
      return { where: { publishDate: { gte: new Date() } }, orderBy: 'asc' };
  }
}

// Each channel's thread is stored as a chain: the first post has no parent and
// every comment points at the item before it, which is the order it is published in.
async function createThreads(tx: Prisma.TransactionClient, data: CreateGroupData) {
  for (const thread of data.threads) {
    let parentPostId: string | null = null;
    for (const value of thread.values) {
      const created: { id: string } = await tx.socialPost.create({
        data: {
          organizationId: data.organizationId,
          integrationId: thread.integrationId,
          group: data.group,
          state: data.state,
          publishDate: data.publishDate,
          content: value.content,
          media: value.media as unknown as Prisma.InputJsonValue,
          delay: value.delay,
          parentPostId,
        },
        select: { id: true },
      });
      parentPostId = created.id;
    }
  }
}

export const postRepository = {
  async list(organizationId: string, page: number, filter: PostListFilter) {
    const { where: filterWhere, orderBy } = listFilter(filter);
    const where: Prisma.SocialPostWhereInput = {
      organizationId,
      deletedAt: null,
      parentPostId: null,
      integration: { deletedAt: null },
      ...filterWhere,
    };

    const [total, results] = await prisma.$transaction([
      prisma.socialPost.count({ where }),
      prisma.socialPost.findMany({
        where,
        include: { integration: { select: channelSelect } },
        orderBy: [{ publishDate: orderBy }, { createdAt: 'asc' }],
        skip: (page - 1) * POSTS_PAGE_SIZE,
        take: POSTS_PAGE_SIZE,
      }),
    ]);

    return { total, results };
  },

  // Number of comments (non-root posts) per group + channel.
  async countComments(organizationId: string, groups: string[]) {
    const counts = await prisma.socialPost.groupBy({
      by: ['group', 'integrationId'],
      where: {
        organizationId,
        group: { in: groups },
        deletedAt: null,
        parentPostId: { not: null },
      },
      _count: { _all: true },
    });
    return new Map(
      counts.map((count) => [`${count.group}:${count.integrationId}`, count._count._all])
    );
  },

  findGroup(organizationId: string, group: string) {
    return prisma.socialPost.findMany({
      where: { organizationId, group, deletedAt: null },
      include: { integration: { select: channelSelect } },
      orderBy: { createdAt: 'asc' },
    });
  },

  createGroup(data: CreateGroupData): Promise<void> {
    return prisma.$transaction((tx) => createThreads(tx, data));
  },

  // Edits replace every row of the group in one transaction; the old rows are
  // soft deleted so nothing half-updated can ever be published.
  replaceGroup(data: CreateGroupData): Promise<void> {
    return prisma.$transaction(async (tx) => {
      await tx.socialPost.updateMany({
        where: { organizationId: data.organizationId, group: data.group, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await createThreads(tx, data);
    });
  },

  async softDeleteGroup(organizationId: string, group: string): Promise<number> {
    const { count } = await prisma.socialPost.updateMany({
      where: { organizationId, group, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count;
  },
};
