import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { PortalSession } from '../approvals/approval.service';

export type PortalReportItem = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  pdfUrl: string | null;
  createdAt: string;
};

/**
 * Client portal Reports — only this session's customer + org.
 * No report body / narrative (agency-facing copy stays internal).
 */
export const portalReportsService = {
  async list(session: Pick<PortalSession, 'organizationId' | 'customerId'>): Promise<PortalReportItem[]> {
    const rows = await prisma.socialClientReport.findMany({
      where: {
        organizationId: session.organizationId,
        customerId: session.customerId,
      },
      orderBy: { createdAt: 'desc' },
      take: 36,
      select: {
        id: true,
        title: true,
        periodStart: true,
        periodEnd: true,
        pdfUrl: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      pdfUrl: row.pdfUrl,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /** Resolve one downloadable report; 404 if it belongs to another client. */
  async getForDownload(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    reportId: string
  ): Promise<PortalReportItem> {
    const row = await prisma.socialClientReport.findFirst({
      where: {
        id: reportId,
        organizationId: session.organizationId,
        customerId: session.customerId,
      },
      select: {
        id: true,
        title: true,
        periodStart: true,
        periodEnd: true,
        pdfUrl: true,
        createdAt: true,
      },
    });
    if (!row) throw new HttpError(404, 'Report not found');
    if (!row.pdfUrl) throw new HttpError(404, 'PDF is not ready yet');
    return {
      id: row.id,
      title: row.title,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      pdfUrl: row.pdfUrl,
      createdAt: row.createdAt.toISOString(),
    };
  },
};
