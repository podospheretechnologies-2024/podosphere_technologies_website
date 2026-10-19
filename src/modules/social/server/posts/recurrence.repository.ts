import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma, SocialRecurrenceRule } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';

export interface UpsertRecurrenceData {
  organizationId: string;
  group: string;
  rule: SocialRecurrenceRule;
  until: Date | null;
  maxRuns: number | null;
  evergreen: boolean;
}

export const recurrenceRepository = {
  findByGroup(group: string) {
    return prisma.socialRecurrence.findUnique({ where: { group } });
  },

  async upsertForGroup(data: UpsertRecurrenceData): Promise<void> {
    const existing = await prisma.socialRecurrence.findUnique({ where: { group: data.group } });
    if (existing) {
      await prisma.socialRecurrence.update({
        where: { id: existing.id },
        data: {
          rule: data.rule,
          until: data.until,
          maxRuns: data.maxRuns,
          evergreen: data.evergreen,
          active: true,
          // Editing resets the run counter so the new schedule is predictable.
          runCount: 0,
        },
      });
      return;
    }

    await prisma.socialRecurrence.create({
      data: {
        organizationId: data.organizationId,
        group: data.group,
        rule: data.rule,
        until: data.until,
        maxRuns: data.maxRuns,
        evergreen: data.evergreen,
        active: true,
        runCount: 0,
      },
    });
  },

  async deactivateForGroup(group: string): Promise<void> {
    await prisma.socialRecurrence.updateMany({
      where: { group, active: true },
      data: { active: false },
    });
  },

  async deleteForGroup(group: string): Promise<void> {
    await prisma.socialRecurrence.deleteMany({ where: { group } });
  },

  /**
   * After every root in `sourceGroup` is PUBLISHED, clone threads into a new
   * group at `publishDate` and move the recurrence onto that group.
   * Returns the new group id, or null when no clone was created (race / limits).
   */
  async cloneGroupAfterPublish(input: {
    organizationId: string;
    sourceGroup: string;
    publishDate: Date;
  }): Promise<string | null> {
    return prisma.$transaction(async (tx) => {
      const recurrence = await tx.socialRecurrence.findFirst({
        where: {
          organizationId: input.organizationId,
          group: input.sourceGroup,
          active: true,
        },
      });
      if (!recurrence) {
        return null;
      }

      const unpublished = await tx.socialPost.count({
        where: {
          organizationId: input.organizationId,
          group: input.sourceGroup,
          deletedAt: null,
          parentPostId: null,
          state: { not: 'PUBLISHED' },
        },
      });
      if (unpublished > 0) {
        return null;
      }

      const nextRun = recurrence.runCount + 1;
      if (recurrence.maxRuns != null && nextRun >= recurrence.maxRuns) {
        await tx.socialRecurrence.update({
          where: { id: recurrence.id },
          data: { runCount: nextRun, active: false },
        });
        return null;
      }

      if (recurrence.until && input.publishDate.getTime() > recurrence.until.getTime()) {
        await tx.socialRecurrence.update({
          where: { id: recurrence.id },
          data: { runCount: nextRun, active: false },
        });
        return null;
      }

      const sourcePosts = await tx.socialPost.findMany({
        where: {
          organizationId: input.organizationId,
          group: input.sourceGroup,
          deletedAt: null,
        },
        include: {
          tags: { select: { tagId: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (sourcePosts.length === 0) {
        return null;
      }

      const newGroup = randomUUID();
      const claimed = await tx.socialRecurrence.updateMany({
        where: {
          id: recurrence.id,
          group: input.sourceGroup,
          active: true,
          runCount: recurrence.runCount,
        },
        data: { group: newGroup, runCount: nextRun },
      });
      if (claimed.count === 0) {
        return null;
      }

      const idMap = new Map<string, string>();
      for (const post of sourcePosts) {
        if (!post.parentPostId) {
          const created = await tx.socialPost.create({
            data: {
              organizationId: post.organizationId,
              customerId: post.customerId,
              integrationId: post.integrationId,
              group: newGroup,
              state: 'QUEUE',
              publishDate: input.publishDate,
              content: post.content,
              firstComment: post.firstComment,
              delay: post.delay,
              settings: post.settings as Prisma.InputJsonValue,
              media: post.media as Prisma.InputJsonValue,
              title: post.title,
              description: post.description,
              creationMethod: post.creationMethod,
              tags:
                post.tags.length > 0
                  ? { create: post.tags.map((tag) => ({ tagId: tag.tagId })) }
                  : undefined,
            },
            select: { id: true },
          });
          idMap.set(post.id, created.id);
        }
      }

      for (const post of sourcePosts) {
        if (!post.parentPostId) continue;
        const parentId = post.parentPostId ? idMap.get(post.parentPostId) : undefined;
        if (!parentId) continue;
        const created = await tx.socialPost.create({
          data: {
            organizationId: post.organizationId,
            customerId: post.customerId,
            integrationId: post.integrationId,
            group: newGroup,
            parentPostId: parentId,
            state: 'QUEUE',
            publishDate: input.publishDate,
            content: post.content,
            delay: post.delay,
            settings: post.settings as Prisma.InputJsonValue,
            media: post.media as Prisma.InputJsonValue,
            title: post.title,
            description: post.description,
            creationMethod: post.creationMethod,
          },
          select: { id: true },
        });
        idMap.set(post.id, created.id);
      }

      return newGroup;
    });
  },
};
