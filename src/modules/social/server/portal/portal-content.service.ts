import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { approvalService, type PortalSession } from '../approvals/approval.service';

export type PortalCalendarItem = {
  id: string;
  date: string;
  kind: 'planned' | 'published' | 'approval';
  title: string;
  channelName: string;
  channelPicture: string | null;
  stateLabel: string;
  group?: string;
  permalink?: string | null;
};

export type PortalContentDto = {
  approvalQueue: Awaited<ReturnType<typeof approvalService.listPortalQueue>>;
  calendar: PortalCalendarItem[];
  month: string;
};

function monthBounds(monthIso?: string): { start: Date; end: Date; label: string } {
  const base =
    monthIso && /^\d{4}-\d{2}$/.test(monthIso) ? new Date(`${monthIso}-01T00:00:00`) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  return { start, end, label };
}

export const portalContentService = {
  async get(session: PortalSession, monthIso?: string): Promise<PortalContentDto> {
    const { start, end, label } = monthBounds(monthIso);
    const { organizationId, customerId } = session;

    const integrations = await prisma.socialIntegration.findMany({
      where: { organizationId, customerId, deletedAt: null },
      select: { id: true, name: true, picture: true },
    });
    const integrationIds = integrations.map((row) => row.id);
    const channelById = new Map(integrations.map((row) => [row.id, row]));

    const [approvalQueue, planned, published] = await Promise.all([
      approvalService.listPortalQueue(session),
      prisma.socialPost.findMany({
        where: {
          organizationId,
          customerId,
          deletedAt: null,
          parentPostId: null,
          publishDate: { gte: start, lte: end },
          state: { in: ['DRAFT', 'QUEUE'] },
        },
        include: {
          integration: { select: { name: true, picture: true } },
        },
        orderBy: { publishDate: 'asc' },
        take: 200,
      }),
      integrationIds.length
        ? prisma.socialExternalPost.findMany({
            where: {
              integrationId: { in: integrationIds },
              publishedAt: { gte: start, lte: end },
            },
            orderBy: { publishedAt: 'asc' },
            take: 200,
            select: {
              id: true,
              integrationId: true,
              caption: true,
              permalink: true,
              publishedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const calendar: PortalCalendarItem[] = [];

    for (const post of planned) {
      const awaitingClient = post.state === 'DRAFT' && post.approvalStep === 'CLIENT';
      calendar.push({
        id: post.id,
        date: post.publishDate.toISOString(),
        kind: awaitingClient ? 'approval' : 'planned',
        title: (post.content || post.title || 'Post').slice(0, 120),
        channelName: post.integration.name,
        channelPicture: post.integration.picture,
        stateLabel: awaitingClient
          ? 'Needs your approval'
          : post.state === 'QUEUE'
            ? 'Scheduled'
            : post.approvalStep === 'INTERNAL'
              ? 'In review'
              : post.approvalStep === 'REJECTED'
                ? 'Changes requested'
                : 'Draft',
        group: post.group,
      });
    }

    for (const post of published) {
      const channel = channelById.get(post.integrationId);
      calendar.push({
        id: post.id,
        date: post.publishedAt.toISOString(),
        kind: 'published',
        title: (post.caption || 'Published post').slice(0, 120),
        channelName: channel?.name ?? 'Channel',
        channelPicture: channel?.picture ?? null,
        stateLabel: 'Published',
        permalink: post.permalink,
      });
    }

    calendar.sort((a, b) => a.date.localeCompare(b.date));

    return { approvalQueue, calendar, month: label };
  },
};
