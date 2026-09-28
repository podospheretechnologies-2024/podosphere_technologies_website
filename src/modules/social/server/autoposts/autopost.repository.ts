import 'server-only';
import type { SocialAutoPost } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import type { SaveAutopostBody } from './autopost.schema';

type AutopostData = SaveAutopostBody & { lastUrl?: string | null };

export const autopostRepository = {
  list(organizationId: string): Promise<SocialAutoPost[]> {
    return prisma.socialAutoPost.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById(organizationId: string, id: string): Promise<SocialAutoPost | null> {
    return prisma.socialAutoPost.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  findActiveById(id: string): Promise<SocialAutoPost | null> {
    return prisma.socialAutoPost.findFirst({ where: { id, active: true, deletedAt: null } });
  },

  findAllActive(): Promise<{ id: string }[]> {
    return prisma.socialAutoPost.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true },
    });
  },

  create(organizationId: string, data: AutopostData): Promise<SocialAutoPost> {
    return prisma.socialAutoPost.create({ data: { organizationId, ...data } });
  },

  update(id: string, data: AutopostData): Promise<SocialAutoPost> {
    return prisma.socialAutoPost.update({ where: { id }, data });
  },

  updateLastUrl(id: string, lastUrl: string): Promise<SocialAutoPost> {
    return prisma.socialAutoPost.update({ where: { id }, data: { lastUrl } });
  },

  softDelete(id: string): Promise<SocialAutoPost> {
    return prisma.socialAutoPost.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  },
};
