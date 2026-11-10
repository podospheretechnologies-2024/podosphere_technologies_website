import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { PortalSession } from '../approvals/approval.service';

export type PortalLeadRow = {
  id: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  score: number | null;
  createdAt: string;
};

export type PortalLeadsSummary = {
  totals: { all: number; byStage: Record<string, number> };
  leads: PortalLeadRow[];
};

/**
 * Client-portal Leads: session org + customer only.
 * No payload JSON, CRM ids, assignee, or score reasons.
 */
export const portalLeadsService = {
  async list(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalLeadsSummary> {
    const rows = await prisma.socialLead.findMany({
      where: {
        organizationId: session.organizationId,
        customerId: session.customerId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        source: true,
        name: true,
        email: true,
        phone: true,
        stage: true,
        score: true,
        createdAt: true,
      },
    });

    const byStage: Record<string, number> = {};
    for (const row of rows) {
      byStage[row.stage] = (byStage[row.stage] ?? 0) + 1;
    }

    return {
      totals: { all: rows.length, byStage },
      leads: rows.map((row) => ({
        id: row.id,
        source: row.source,
        name: row.name,
        email: row.email,
        phone: row.phone,
        stage: row.stage,
        score: row.score,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  },
};
