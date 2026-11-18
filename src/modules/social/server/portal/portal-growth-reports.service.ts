import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { PortalSession } from '../approvals/approval.service';
import { portalReportsService, type PortalReportItem } from './portal-reports.service';

export type PortalGrowthDeskReport = {
  id: string;
  kind: 'pdf' | 'growth';
  title: string;
  periodStart: string;
  periodEnd: string;
  /** Short client-visible summary; never includes tokens or staff notes. */
  summary: string | null;
  pdfUrl: string | null;
  createdAt: string;
};

/**
 * Growth desk Reports: SocialClientReport (PDF) + SocialGrowthReport titles/summaries.
 * No KPI dumps, targets, or agency narrative extras.
 */
export const portalGrowthReportsService = {
  async list(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalGrowthDeskReport[]> {
    const [pdfReports, growthRows] = await Promise.all([
      portalReportsService.list(session),
      prisma.socialGrowthReport.findMany({
        where: {
          organizationId: session.organizationId,
          customerId: session.customerId,
        },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: {
          id: true,
          title: true,
          periodStart: true,
          periodEnd: true,
          summary: true,
          createdAt: true,
        },
      }),
    ]);

    const pdfItems: PortalGrowthDeskReport[] = pdfReports.map((row) => ({
      id: row.id,
      kind: 'pdf',
      title: row.title,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      summary: null,
      pdfUrl: row.pdfUrl,
      createdAt: row.createdAt,
    }));

    const growthItems: PortalGrowthDeskReport[] = growthRows.map((row) => ({
      id: row.id,
      kind: 'growth',
      title: row.title,
      periodStart: row.periodStart.toISOString().slice(0, 10),
      periodEnd: row.periodEnd.toISOString().slice(0, 10),
      summary: row.summary.slice(0, 600),
      pdfUrl: null,
      createdAt: row.createdAt.toISOString(),
    }));

    return [...pdfItems, ...growthItems].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  },

  async getPdfForDownload(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    reportId: string
  ): Promise<PortalReportItem> {
    return portalReportsService.getForDownload(session, reportId);
  },

  async getGrowthSummary(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    reportId: string
  ): Promise<PortalGrowthDeskReport> {
    const row = await prisma.socialGrowthReport.findFirst({
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
        summary: true,
        createdAt: true,
      },
    });
    if (!row) throw new HttpError(404, 'Report not found');
    return {
      id: row.id,
      kind: 'growth',
      title: row.title,
      periodStart: row.periodStart.toISOString().slice(0, 10),
      periodEnd: row.periodEnd.toISOString().slice(0, 10),
      summary: row.summary.slice(0, 2000),
      pdfUrl: null,
      createdAt: row.createdAt.toISOString(),
    };
  },
};
