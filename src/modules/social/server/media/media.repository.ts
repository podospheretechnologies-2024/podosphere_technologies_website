import 'server-only';
import type { Prisma, SocialMedia, SocialMediaFormat } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { MEDIA_PAGE_SIZE } from '../../config/media';

interface ListMediaParams {
  scope: ClientScope;
  page: number;
  search?: string;
  format?: SocialMediaFormat;
}

export const mediaRepository = {
  async list({ scope, page, search, format }: ListMediaParams) {
    const where: Prisma.SocialMediaWhereInput = {
      ...scopeWhere(scope),
      deletedAt: null,
      status: 'READY',
      ...(search ? { originalName: { contains: search } } : {}),
      ...(format ? { format } : {}),
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

  update(id: string, data: Prisma.SocialMediaUncheckedUpdateInput): Promise<SocialMedia> {
    return prisma.socialMedia.update({ where: { id }, data });
  },

  findById(scope: ClientScope, id: string): Promise<SocialMedia | null> {
    return prisma.socialMedia.findFirst({
      where: { id, ...scopeWhere(scope), deletedAt: null },
    });
  },

  /** Org-wide by id (workers / publish). Prefer findById(scope) for request paths. */
  findManyByIds(organizationId: string, ids: string[]): Promise<SocialMedia[]> {
    return prisma.socialMedia.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null, status: 'READY' },
    });
  },

  softDelete(id: string): Promise<SocialMedia> {
    return prisma.socialMedia.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
