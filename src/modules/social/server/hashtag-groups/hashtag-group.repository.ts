import 'server-only';
import type { SocialHashtagGroup } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

interface HashtagGroupData {
  name: string;
  hashtags: string;
}

export const hashtagGroupRepository = {
  list(scope: ClientScope): Promise<SocialHashtagGroup[]> {
    return prisma.socialHashtagGroup.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      orderBy: { name: 'asc' },
    });
  },

  findById(scope: ClientScope, id: string): Promise<SocialHashtagGroup | null> {
    return prisma.socialHashtagGroup.findFirst({
      where: { id, ...scopeWhere(scope), deletedAt: null },
    });
  },

  findByName(
    organizationId: string,
    customerId: string | null,
    name: string
  ): Promise<SocialHashtagGroup | null> {
    return prisma.socialHashtagGroup.findFirst({
      where: { organizationId, customerId, deletedAt: null, name: { equals: name } }, // MySQL collation is case-insensitive
    });
  },

  create(
    organizationId: string,
    customerId: string | null,
    data: HashtagGroupData
  ): Promise<SocialHashtagGroup> {
    return prisma.socialHashtagGroup.create({ data: { organizationId, customerId, ...data } });
  },

  update(id: string, data: HashtagGroupData): Promise<SocialHashtagGroup> {
    return prisma.socialHashtagGroup.update({ where: { id }, data });
  },

  softDelete(id: string): Promise<SocialHashtagGroup> {
    return prisma.socialHashtagGroup.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
