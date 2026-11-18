import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { PortalSession } from '../approvals/approval.service';

export type PortalGrowthIdeaItem = {
  id: string;
  area: string;
  ask: string;
  createdAt: string;
};

/** Area tag so the agency Idea box can tell client submissions apart from AI briefs. */
export const PORTAL_IDEA_AREA = 'client';

/**
 * Portal Idea box: client submits text → SocialBrief for the agency.
 * No AI call from the portal.
 */
export const portalGrowthIdeasService = {
  async list(
    session: Pick<PortalSession, 'organizationId' | 'customerId' | 'approverId'>
  ): Promise<PortalGrowthIdeaItem[]> {
    const rows = await prisma.socialBrief.findMany({
      where: {
        organizationId: session.organizationId,
        customerId: session.customerId,
        OR: [{ createdById: session.approverId }, { area: PORTAL_IDEA_AREA }],
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true, area: true, ask: true, createdAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      area: row.area,
      ask: row.ask,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async create(
    session: PortalSession,
    input: { ask: string; area?: string }
  ): Promise<PortalGrowthIdeaItem> {
    const ask = input.ask.trim().slice(0, 4000);
    const area = (input.area?.trim() || PORTAL_IDEA_AREA).slice(0, 40);
    const row = await prisma.socialBrief.create({
      data: {
        organizationId: session.organizationId,
        customerId: session.customerId,
        area,
        ask,
        output: undefined,
        createdById: session.approverId,
      },
      select: { id: true, area: true, ask: true, createdAt: true },
    });
    return {
      id: row.id,
      area: row.area,
      ask: row.ask,
      createdAt: row.createdAt.toISOString(),
    };
  },
};
