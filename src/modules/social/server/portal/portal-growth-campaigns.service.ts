import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { adPlanService } from '../growth/records.service';
import type { PortalSession } from '../approvals/approval.service';

export type PortalGrowthCampaignItem = {
  id: string;
  campaignName: string;
  objective: string | null;
  budgetNote: string | null;
  adsetName: string;
  audience: string | null;
  adName: string;
  format: string | null;
  hook: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  cta: string | null;
  landingPage: string | null;
  product: string | null;
  status: string;
  feedback: string | null;
  decidedAt: string | null;
  createdAt: string;
};

function toPortal(
  row: Awaited<ReturnType<typeof adPlanService.list>>[number]
): PortalGrowthCampaignItem {
  return {
    id: row.id,
    campaignName: row.campaignName,
    objective: row.objective,
    budgetNote: row.budgetNote,
    adsetName: row.adsetName,
    audience: row.audience,
    adName: row.adName,
    format: row.format,
    hook: row.hook,
    primaryText: row.primaryText,
    headline: row.headline,
    description: row.description,
    cta: row.cta,
    landingPage: row.landingPage,
    product: row.product,
    status: row.status,
    feedback: row.feedback,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Portal campaign plan: list proposed ads; approve/reject with approverId audit.
 * Never trusts clientId from the body — session only.
 */
export const portalGrowthCampaignsService = {
  async list(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalGrowthCampaignItem[]> {
    const rows = await adPlanService.list(session.organizationId, session.customerId);
    return rows.map(toPortal);
  },

  async decide(
    session: PortalSession,
    id: string,
    status: 'approved' | 'rejected',
    feedback?: string | null
  ): Promise<PortalGrowthCampaignItem> {
    const existing = await prisma.socialAdPlanItem.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
        customerId: session.customerId,
      },
      select: { id: true, status: true },
    });
    if (!existing) throw new HttpError(404, 'Campaign not found');

    const updated = await adPlanService.decide(
      session.organizationId,
      session.customerId,
      id,
      status,
      feedback?.trim() || null,
      session.approverId
    );
    return toPortal(updated);
  },
};
