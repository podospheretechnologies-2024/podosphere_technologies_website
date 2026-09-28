import 'server-only';
import type { Prisma, SocialMedia } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { MEDIA_PAGE_SIZE } from '../../config/media';

interface ListMediaParams {
  organizationId: string;
  page: number;
  search?: string;
}

export const mediaRepository = {
  async list({ organizationId, page, search }: ListMediaParams) {
    const where: Prisma.SocialMediaWhereInput = {
      organizationId,
      deletedAt: null,
      status: 'READY',
      ...(search ? { originalName: { contains: search } } : {}),
    };

    const [total, results] = await prisma.$transaction([
      prisma.socialMedia.count({ where }),
      prisma.socialMedia.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * MEDIA_PAGE_SIZE,
        take: MEDIA_PAGE_SIZE,
      }),
    ]);

    return { total, results };
  },

  create(data: Prisma.SocialMediaUncheckedCreateInput): Promise<SocialMedia> {
    return prisma.socialMedia.create({ data });
  },

  findById(organizationId: string, id: string): Promise<SocialMedia | null> {
    return prisma.socialMedia.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  findManyByIds(organizationId: string, ids: string[]): Promise<SocialMedia[]> {
    return prisma.socialMedia.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null, status: 'READY' },
    });
  },

  softDelete(id: string): Promise<SocialMedia> {
    return prisma.socialMedia.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
