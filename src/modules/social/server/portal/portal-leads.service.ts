import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { logAudit } from '@/shared/server/audit.service';
import { HttpError } from '@/shared/server/http-error';
import type { PortalSession } from '../approvals/approval.service';
import { LEAD_STAGES, type LeadStage } from '../inbox/inbox.schema';
import { computeLeadScore, scoreReasonsToJson } from '../inbox/lead-score';

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

function mapLead(row: {
  id: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  score: number | null;
  createdAt: Date;
}): PortalLeadRow {
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    email: row.email,
    phone: row.phone,
    stage: row.stage,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
  };
}

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
      leads: rows.map(mapLead),
    };
  },

  /**
   * Change pipeline stage for one of this client's leads. Session org + customer only —
   * client A can never mutate client B's leads.
   */
  async updateStage(
    session: PortalSession,
    leadId: string,
    stage: LeadStage
  ): Promise<PortalLeadRow> {
    if (!(LEAD_STAGES as readonly string[]).includes(stage)) {
      throw new HttpError(400, 'Invalid lead stage');
    }

    const existing = await prisma.socialLead.findFirst({
      where: {
        id: leadId,
        organizationId: session.organizationId,
        customerId: session.customerId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        payload: true,
        stage: true,
      },
    });
    if (!existing) throw new HttpError(404, 'Lead not found');

    const { score, reasons } = computeLeadScore({
      stage,
      name: existing.name,
      email: existing.email,
      phone: existing.phone,
      payload: existing.payload,
    });

    const updated = await prisma.socialLead.update({
      where: { id: existing.id },
      data: {
        stage,
        score,
        scoreReasons: scoreReasonsToJson(reasons),
        scoredAt: new Date(),
      },
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

    await logAudit({
      action: 'portal.lead_stage',
      targetType: 'social_lead',
      targetId: updated.id,
      metadata: {
        customerId: session.customerId,
        approverId: session.approverId,
        from: existing.stage,
        to: stage,
      },
    });

    return mapLead(updated);
  },
};
