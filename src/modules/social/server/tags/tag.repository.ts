import 'server-only';
import type { SocialTag } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import type { SaveTagBody } from './tag.schema';

export const tagRepository = {
  list(scope: ClientScope): Promise<SocialTag[]> {
    return prisma.socialTag.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      orderBy: { name: 'asc' },
    });
  },

  findById(scope: ClientScope, id: string): Promise<SocialTag | null> {
    return prisma.socialTag.findFirst({ where: { id, ...scopeWhere(scope), deletedAt: null } });
  },

  /** Org-wide by id (posts / templates). Prefer findById(scope) for request paths. */
  findManyByIds(organizationId: string, ids: string[]): Promise<SocialTag[]> {
    return prisma.socialTag.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null },
    });
  },

  findByName(
    organizationId: string,
    customerId: string | null,
    name: string
  ): Promise<SocialTag | null> {
    return prisma.socialTag.findFirst({
      where: { organizationId, customerId, deletedAt: null, name: { equals: name } }, // MySQL collation is case-insensitive
    });
  },

  create(
    organizationId: string,
    customerId: string | null,
    data: SaveTagBody
  ): Promise<SocialTag> {
    return prisma.socialTag.create({ data: { organizationId, customerId, ...data } });
  },

  update(id: string, data: SaveTagBody): Promise<SocialTag> {
    return prisma.socialTag.update({ where: { id }, data });
  },

  softDelete(id: string): Promise<SocialTag> {
    return prisma.socialTag.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
