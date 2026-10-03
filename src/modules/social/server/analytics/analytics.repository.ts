import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';

// Only the first post of each channel counts; thread comments are part of the same post.
function rootPostsWhere(organizationId: string): Prisma.SocialPostWhereInput {
  return {
    organizationId,
    deletedAt: null,
    parentPostId: null,
    integration: { deletedAt: null },
  };
}

export const analyticsRepository = {
  listOutcomes(organizationId: string, start: Date, end: Date) {
    return prisma.socialPost.findMany({
      where: {
        ...rootPostsWhere(organizationId),
        state: { in: ['PUBLISHED', 'ERROR'] },
        publishDate: { gte: start, lt: end },
      },
      select: { integrationId: true, state: true, publishDate: true },
      orderBy: { publishDate: 'asc' },
    });
  },

  countUpcoming(organizationId: string, from: Date): Promise<number> {
    return prisma.socialPost.count({
      where: { ...rootPostsWhere(organizationId), state: 'QUEUE', publishDate: { gte: from } },
    });
  },

  countDrafts(organizationId: string): Promise<number> {
    return prisma.socialPost.count({
      where: { ...rootPostsWhere(organizationId), state: 'DRAFT' },
    });
  },

  listChannels(organizationId: string) {
    return prisma.socialIntegration.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        picture: true,
        providerIdentifier: true,
        internalId: true,
        accessToken: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  listPublishedPosts(organizationId: string, start: Date, end: Date) {
    return prisma.socialPost.findMany({
      where: {
        ...rootPostsWhere(organizationId),
        state: 'PUBLISHED',
        publishDate: { gte: start, lt: end },
      },
      select: {
        id: true,
        content: true,
        media: true,
        publishDate: true,
        releaseId: true,
        releaseUrl: true,
        integration: {
          select: {
            id: true,
            name: true,
            picture: true,
            providerIdentifier: true,
            accessToken: true,
          },
        },
      },
      orderBy: { publishDate: 'desc' },
    });
  },
};
