import 'server-only';
import type { Prisma, SocialSet } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';

export const setRepository = {
  list(organizationId: string): Promise<SocialSet[]> {
    return prisma.socialSet.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
  },

  findById(organizationId: string, id: string): Promise<SocialSet | null> {
    return prisma.socialSet.findFirst({ where: { id, organizationId } });
  },

  create(organizationId: string, name: string, content: Prisma.InputJsonValue): Promise<SocialSet> {
    return prisma.socialSet.create({ data: { organizationId, name, content } });
  },

  rename(id: string, name: string): Promise<SocialSet> {
    return prisma.socialSet.update({ where: { id }, data: { name } });
  },

  // Templates have no deletedAt column: nothing references them, so they are removed.
  delete(id: string): Promise<SocialSet> {
    return prisma.socialSet.delete({ where: { id } });
  },
};
