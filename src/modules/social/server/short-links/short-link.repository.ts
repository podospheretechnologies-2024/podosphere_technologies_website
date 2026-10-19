import 'server-only';
import type { SocialShortLink } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

export interface ShortLinkCreateData {
  code: string;
  targetUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}

export const shortLinkRepository = {
  list(scope: ClientScope): Promise<SocialShortLink[]> {
    return prisma.socialShortLink.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  findByCode(code: string): Promise<SocialShortLink | null> {
    return prisma.socialShortLink.findFirst({
      where: { code, deletedAt: null },
    });
  },

  create(
    organizationId: string,
    customerId: string | null,
    data: ShortLinkCreateData
  ): Promise<SocialShortLink> {
    return prisma.socialShortLink.create({
      data: { organizationId, customerId, ...data },
    });
  },

  incrementClicks(id: string): Promise<SocialShortLink> {
    return prisma.socialShortLink.update({
      where: { id },
      data: { clicks: { increment: 1 } },
    });
  },
};
