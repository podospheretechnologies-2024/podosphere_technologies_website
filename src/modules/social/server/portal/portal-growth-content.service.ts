import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { contentStage } from '../growth/records.service';
import type { PortalSession } from '../approvals/approval.service';

export type PortalGrowthContentItem = {
  id: string;
  title: string;
  stage: string;
  publishDate: string;
  channel: string;
  provider: string;
  url: string | null;
  late: boolean;
};

export type PortalGrowthContentSummary = {
  since: string;
  until: string;
  counts: {
    draft: number;
    scheduled: number;
    posted: number;
    review: number;
    other: number;
  };
  items: PortalGrowthContentItem[];
};

function postTitle(post: { title: string | null; content: string }): string {
  const raw =
    post.title?.trim() ||
    post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (raw || 'Untitled post').slice(0, 90);
}

/**
 * Portal-safe content schedule for Growth desk. No boost budget/spend, staff notes, or captions.
 */
export const portalGrowthContentService = {
  async summary(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalGrowthContentSummary> {
    const now = Date.now();
    const since = new Date(now - 45 * 86_400_000);
    const until = new Date(now + 60 * 86_400_000);

    const posts = await prisma.socialPost.findMany({
      where: {
        organizationId: session.organizationId,
        customerId: session.customerId,
        deletedAt: null,
        parentPostId: null,
        publishDate: { gte: since, lte: until },
      },
      orderBy: { publishDate: 'asc' },
      take: 200,
      select: {
        id: true,
        state: true,
        approvalStep: true,
        publishDate: true,
        title: true,
        content: true,
        releaseUrl: true,
        integration: { select: { name: true, providerIdentifier: true } },
      },
    });

    const counts = { draft: 0, scheduled: 0, posted: 0, review: 0, other: 0 };
    const items: PortalGrowthContentItem[] = posts.map((p) => {
      const stage = contentStage(p);
      if (stage === 'draft') counts.draft += 1;
      else if (stage === 'scheduled') counts.scheduled += 1;
      else if (stage === 'posted') counts.posted += 1;
      else if (stage === 'internal_review' || stage === 'client_review') counts.review += 1;
      else counts.other += 1;

      return {
        id: p.id,
        title: postTitle(p),
        stage,
        publishDate: p.publishDate.toISOString(),
        channel: p.integration.name,
        provider: p.integration.providerIdentifier,
        url: p.releaseUrl,
        late: !['posted', 'scheduled'].includes(stage) && p.publishDate.getTime() < now,
      };
    });

    return {
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
      counts,
      items,
    };
  },
};
