import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { blogsService } from '../growth/records.service';
import type { PortalSession } from '../approvals/approval.service';

export type PortalGrowthBlogItem = {
  id: string;
  title: string;
  angle: string | null;
  metaDescription: string | null;
  /** Plain excerpt for preview — never raw staff notes. */
  excerpt: string | null;
  status: string;
  feedback: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function plainExcerpt(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\/(p|h2|h3|li)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, 280) : null;
}

function toPortal(row: Awaited<ReturnType<typeof blogsService.list>>[number]): PortalGrowthBlogItem {
  return {
    id: row.id,
    title: row.title,
    angle: row.angle,
    metaDescription: row.metaDescription,
    excerpt: plainExcerpt(row.bodyHtml),
    status: row.status,
    feedback: row.feedback,
    publishedUrl: row.publishedUrl,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Portal blogs: list drafts; approve or ask for changes (act).
 */
export const portalGrowthBlogsService = {
  async list(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalGrowthBlogItem[]> {
    const rows = await blogsService.list(session.organizationId, session.customerId);
    return rows
      .filter((row) => ['draft', 'changes', 'approved', 'published'].includes(row.status))
      .map(toPortal);
  },

  async decide(
    session: PortalSession,
    id: string,
    action: 'approve' | 'changes',
    feedback?: string | null
  ): Promise<PortalGrowthBlogItem> {
    const existing = await prisma.socialBlog.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
        customerId: session.customerId,
      },
      select: { id: true, status: true, bodyHtml: true },
    });
    if (!existing) throw new HttpError(404, 'Blog not found');
    if (!['draft', 'changes', 'approved'].includes(existing.status)) {
      throw new HttpError(409, `This blog is "${existing.status}" and cannot be decided here.`);
    }
    if (action === 'approve' && !existing.bodyHtml) {
      throw new HttpError(400, 'This draft has no text yet.');
    }
    if (action === 'changes' && !(feedback?.trim())) {
      throw new HttpError(400, 'Tell the agency what to change.');
    }

    const note =
      action === 'approve'
        ? feedback?.trim() || `Approved by portal (${session.approverId})`.slice(0, 500)
        : feedback!.trim();

    const updated = await blogsService.update(session.organizationId, session.customerId, id, {
      status: action === 'approve' ? 'approved' : 'changes',
      feedback: note,
    });
    return toPortal(updated);
  },
};
