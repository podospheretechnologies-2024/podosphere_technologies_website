import 'server-only';
import type { Prisma, SocialSet } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

export const setRepository = {
  list(scope: ClientScope): Promise<SocialSet[]> {
    return prisma.socialSet.findMany({
      where: scopeWhere(scope),
      orderBy: { name: 'asc' },
    });
  },

  findById(scope: ClientScope, id: string): Promise<SocialSet | null> {
    return prisma.socialSet.findFirst({ where: { id, ...scopeWhere(scope) } });
  },

  create(
    organizationId: string,
    customerId: string | null,
    name: string,
    content: Prisma.InputJsonValue
  ): Promise<SocialSet> {
    return prisma.socialSet.create({ data: { organizationId, customerId, name, content } });
  },

  rename(id: string, name: string): Promise<SocialSet> {
    return prisma.socialSet.update({ where: { id }, data: { name } });
  },

  // Templates have no deletedAt column: nothing references them, so they are removed.
  delete(id: string): Promise<SocialSet> {
    return prisma.socialSet.delete({ where: { id } });
  },
};
