import 'server-only';
import type { SocialTag } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import type { SaveTagBody } from './tag.schema';

export const tagRepository = {
  list(organizationId: string): Promise<SocialTag[]> {
    return prisma.socialTag.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  },

  findById(organizationId: string, id: string): Promise<SocialTag | null> {
    return prisma.socialTag.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  findManyByIds(organizationId: string, ids: string[]): Promise<SocialTag[]> {
    return prisma.socialTag.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null },
    });
  },

  findByName(organizationId: string, name: string): Promise<SocialTag | null> {
    return prisma.socialTag.findFirst({
      where: { organizationId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
    });
  },

  create(organizationId: string, data: SaveTagBody): Promise<SocialTag> {
    return prisma.socialTag.create({ data: { organizationId, ...data } });
  },

  update(id: string, data: SaveTagBody): Promise<SocialTag> {
    return prisma.socialTag.update({ where: { id }, data });
  },

  softDelete(id: string): Promise<SocialTag> {
    return prisma.socialTag.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
