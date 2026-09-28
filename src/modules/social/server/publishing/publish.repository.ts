import 'server-only';
import type { SocialPost } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';

export interface FailPostData {
  platform: string;
  message: string;
  body?: string;
}

export const publishRepository = {
  findPost(id: string) {
    return prisma.socialPost.findUnique({
      where: { id },
      include: {
        integration: true,
        parentPost: { select: { state: true, releaseId: true } },
      },
    });
  },

  findRoot(post: Pick<SocialPost, 'group' | 'integrationId'>) {
    return prisma.socialPost.findFirst({
      where: {
        group: post.group,
        integrationId: post.integrationId,
        parentPostId: null,
        deletedAt: null,
      },
      select: { releaseId: true },
    });
  },

  findNext(postId: string) {
    return prisma.socialPost.findFirst({
      where: { parentPostId: postId, deletedAt: null },
      select: { id: true, publishDate: true, delay: true },
    });
  },

  // Queued first posts that are due before `before` (overdue ones included).
  findDueRoots(before: Date) {
    return prisma.socialPost.findMany({
      where: { state: 'QUEUE', deletedAt: null, parentPostId: null, publishDate: { lte: before } },
      select: { id: true, publishDate: true },
    });
  },

  // Queued comments whose previous item is already published.
  findPendingComments() {
    return prisma.socialPost.findMany({
      where: { state: 'QUEUE', deletedAt: null, parentPost: { state: 'PUBLISHED' } },
      select: {
        id: true,
        publishDate: true,
        delay: true,
        parentPost: { select: { updatedAt: true } },
      },
    });
  },

  markPublished(id: string, release: { releaseId: string; releaseUrl: string }) {
    return prisma.socialPost.update({
      where: { id },
      data: { state: 'PUBLISHED', error: null, ...release },
    });
  },

  // The failed item and everything still queued after it in the same thread
  // are marked as failed, so nothing is published out of order.
  async markFailed(post: SocialPost, data: FailPostData): Promise<void> {
    await prisma.$transaction([
      prisma.socialPost.updateMany({
        where: {
          group: post.group,
          integrationId: post.integrationId,
          deletedAt: null,
          state: 'QUEUE',
          createdAt: { gte: post.createdAt },
        },
        data: { state: 'ERROR', error: data.message },
      }),
      prisma.socialPostError.create({
        data: {
          organizationId: post.organizationId,
          postId: post.id,
          platform: data.platform,
          message: data.message,
          body: data.body ? { response: data.body } : {},
        },
      }),
    ]);
  },
};
