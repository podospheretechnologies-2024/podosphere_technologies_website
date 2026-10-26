import 'server-only';
import type { Prisma, SocialBioLink, SocialBioPage } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

export type BioPageWithLinks = SocialBioPage & { links: SocialBioLink[] };

const linksInclude = {
  links: { orderBy: { position: 'asc' } },
} satisfies Prisma.SocialBioPageInclude;

interface PageScalars {
  slug: string;
  title: string;
  headline: string | null;
  avatarUrl: string | null;
  theme: string;
  published: boolean;
}

interface LinkInput {
  id?: string;
  label: string;
  url: string;
}

export const bioPageRepository = {
  list(scope: ClientScope): Promise<BioPageWithLinks[]> {
    return prisma.socialBioPage.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: linksInclude,
    });
  },

  findById(scope: ClientScope, id: string): Promise<BioPageWithLinks | null> {
    return prisma.socialBioPage.findFirst({
      where: { id, ...scopeWhere(scope), deletedAt: null },
      include: linksInclude,
    });
  },

  /** Public lookup for /b/[slug]: only a published, non-deleted page. */
  findPublishedBySlug(slug: string): Promise<BioPageWithLinks | null> {
    return prisma.socialBioPage.findFirst({
      where: { slug, published: true, deletedAt: null },
      include: linksInclude,
    });
  },

  slugTaken(slug: string, exceptId?: string): Promise<SocialBioPage | null> {
    return prisma.socialBioPage.findFirst({
      where: { slug, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
  },

  create(
    organizationId: string,
    customerId: string | null,
    page: PageScalars,
    links: LinkInput[]
  ): Promise<BioPageWithLinks> {
    return prisma.socialBioPage.create({
      data: {
        organizationId,
        customerId,
        ...page,
        links: {
          create: links.map((link, index) => ({
            label: link.label,
            url: link.url,
            position: index,
          })),
        },
      },
      include: linksInclude,
    });
  },

  /** Updates the page and reconciles its links, keeping the click count of links that stay. */
  async save(id: string, page: PageScalars, links: LinkInput[]): Promise<BioPageWithLinks> {
    return prisma.$transaction(async (tx) => {
      await tx.socialBioPage.update({ where: { id }, data: page });

      const existing = await tx.socialBioLink.findMany({
        where: { bioPageId: id },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((link) => link.id));
      const keptIds = new Set(links.filter((link) => link.id && existingIds.has(link.id)).map((link) => link.id));

      const toDelete = existing.filter((link) => !keptIds.has(link.id)).map((link) => link.id);
      if (toDelete.length > 0) {
        await tx.socialBioLink.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (let index = 0; index < links.length; index += 1) {
        const link = links[index];
        if (link.id && existingIds.has(link.id)) {
          await tx.socialBioLink.update({
            where: { id: link.id },
            data: { label: link.label, url: link.url, position: index },
          });
        } else {
          await tx.socialBioLink.create({
            data: { bioPageId: id, label: link.label, url: link.url, position: index },
          });
        }
      }

      return tx.socialBioPage.findUniqueOrThrow({ where: { id }, include: linksInclude });
    });
  },

  softDelete(id: string): Promise<SocialBioPage> {
    return prisma.socialBioPage.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  incrementViews(id: string): Promise<SocialBioPage> {
    return prisma.socialBioPage.update({ where: { id }, data: { views: { increment: 1 } } });
  },

  /** Resolve a link for the public /bl/[id] redirect; only links on a published page. */
  findRedirectTarget(
    linkId: string
  ): Promise<(SocialBioLink & { bioPage: Pick<SocialBioPage, 'published' | 'deletedAt'> }) | null> {
    return prisma.socialBioLink.findFirst({
      where: { id: linkId, bioPage: { published: true, deletedAt: null } },
      include: { bioPage: { select: { published: true, deletedAt: true } } },
    });
  },

  incrementClicks(linkId: string): Promise<SocialBioLink> {
    return prisma.socialBioLink.update({ where: { id: linkId }, data: { clicks: { increment: 1 } } });
  },
};
