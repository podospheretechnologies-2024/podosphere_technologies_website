import 'server-only';
import type { SocialSavedReply } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import type { SaveSavedReplyBody } from './saved-reply.schema';

export const savedReplyRepository = {
  list(scope: ClientScope): Promise<SocialSavedReply[]> {
    return prisma.socialSavedReply.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      orderBy: [{ title: 'asc' }, { createdAt: 'asc' }],
    });
  },

  findById(scope: ClientScope, id: string): Promise<SocialSavedReply | null> {
    return prisma.socialSavedReply.findFirst({
      where: { id, ...scopeWhere(scope), deletedAt: null },
    });
  },

  create(
    organizationId: string,
    customerId: string | null,
    data: SaveSavedReplyBody
  ): Promise<SocialSavedReply> {
    return prisma.socialSavedReply.create({
      data: { organizationId, customerId, title: data.title, body: data.body },
    });
  },

  update(id: string, data: SaveSavedReplyBody): Promise<SocialSavedReply> {
    return prisma.socialSavedReply.update({
      where: { id },
      data: { title: data.title, body: data.body },
    });
  },

  softDelete(id: string): Promise<SocialSavedReply> {
    return prisma.socialSavedReply.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
