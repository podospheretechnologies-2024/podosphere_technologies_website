import 'server-only';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { organizationScope, scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { sendEmail } from '@/shared/server/mailer';
import { legal } from '@/modules/marketing/config/legal';
import { planOrDefault } from '../../config/plans';
import { isClaudeConfigured, askClaude } from '../ai/claude.client';
import { planService } from '../billing/plan.service';
import { getStorage } from '../storage/storage.factory';
import { getReportQueue, REPORT_JOB, type MonthlyReportJobData } from './report.queue';

const ReportFormat = z.object({
  title: z.string(),
  body: z.string(),
});

const NarrativeFormat = z.object({
  wins: z.string(),
  losses: z.string(),
  nextSteps: z.string(),
});

function formatNarrative(parts: z.infer<typeof NarrativeFormat>): string {
  return [
    `Wins\n${parts.wins.trim()}`,
    `Losses\n${parts.losses.trim()}`,
    `Next steps\n${parts.nextSteps.trim()}`,
  ].join('\n\n');
}

/** Soft-fail: returns null when Claude is off or the call fails. */
async function writeNarrative(scope: ClientScope, facts: string): Promise<string | null> {
  if (!isClaudeConfigured()) return null;
  try {
    const written = await askClaude({
      scope,
      feature: 'client-report-narrative',
      schema: NarrativeFormat,
      task: [
        'Write a short client-facing monthly narrative from the metrics in the input.',
        'Return wins (what went well), losses (gaps or weak spots), and nextSteps (concrete actions for next month).',
        'Use only the numbers and facts provided. Do not invent metrics, clients, or results.',
        'Keep each section to 2–4 short sentences in plain prose.',
      ].join('\n'),
      input: facts,
      effort: 'low',
    });
    return formatNarrative(written);
  } catch (error) {
    console.error('[reports] narrative generation failed', error);
    return null;
  }
}

function previousCalendarMonth(now = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  return { periodStart, periodEnd };
}

function periodLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric', timeZone: 'UTC' };
  const startLabel = start.toLocaleDateString('en-IN', opts);
  const endLabel = end.toLocaleDateString('en-IN', opts);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return Number(value);
}

function bufferToReadableStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return Readable.toWeb(Readable.from(buffer)) as ReadableStream<Uint8Array>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function emailReportToApprovers(opts: {
  organizationId: string;
  customerId: string;
  clientName: string;
  title: string;
  periodLabel: string;
  pdfUrl: string | null;
}) {
  if (!opts.pdfUrl) {
    console.log(`[reports] no pdfUrl for customer ${opts.customerId} — skipping email`);
    return { skipped: true as const, reason: 'no pdfUrl' };
  }

  const approvers = await prisma.clientApprover.findMany({
    where: { organizationId: opts.organizationId, customerId: opts.customerId },
    select: { email: true, name: true },
  });
  const recipients = [...new Set(approvers.map((row) => row.email.trim()).filter(Boolean))];
  if (recipients.length === 0) {
    console.log(`[reports] no ClientApprover emails for customer ${opts.customerId} — skipping email`);
    return { skipped: true as const, reason: 'no approvers' };
  }

  const safeTitle = escapeHtml(opts.title);
  const safeClient = escapeHtml(opts.clientName);
  const safePeriod = escapeHtml(opts.periodLabel);
  const safeUrl = escapeHtml(opts.pdfUrl);
  const html = `
    <p>Hello,</p>
    <p>Your monthly client report for <strong>${safeClient}</strong> (${safePeriod}) is ready.</p>
    <p><strong>${safeTitle}</strong></p>
    <p><a href="${safeUrl}">Download the PDF report</a></p>
    <p style="color:#666;font-size:12px;">Sent by ${escapeHtml(legal.product)} · ${escapeHtml(legal.company)}</p>
  `.trim();

  const result = await sendEmail({
    to: recipients,
    subject: `${opts.title} — ${opts.periodLabel}`,
    html,
  });

  if (result.ok) {
    console.log(
      `[reports] emailed report ${opts.customerId} to ${recipients.length} approver(s) (id=${result.id})`
    );
  } else if ('skipped' in result) {
    console.log(`[reports] email skipped for customer ${opts.customerId}: ${result.reason}`);
  } else {
    console.error(`[reports] email failed for customer ${opts.customerId}: ${result.error}`);
  }

  return result;
}

async function resolveCustomerIds(scope: ClientScope): Promise<string[]> {
  if (scope.customerIds !== 'all') {
    return scope.customerIds;
  }
  const rows = await prisma.socialCustomer.findMany({
    where: { organizationId: scope.organizationId, deletedAt: null },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export const reportService = {
  async list(scope: ClientScope) {
    const rows = await prisma.socialClientReport.findMany({
      where: scopeWhere(scope),
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      body: row.body,
      narrative: row.narrative,
      pdfUrl: row.pdfUrl,
      customerId: row.customerId,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /**
   * Enqueues one monthly PDF job per client in the current scope (manual UI).
   * Does not email approvers — use the monthly schedule job for delivery.
   */
  async enqueueMonthlyPdfs(scope: ClientScope) {
    await planService.assertFeature(scope.organizationId, 'reports');
    const customerIds = await resolveCustomerIds(scope);
    if (customerIds.length === 0) {
      throw new HttpError(400, 'Select a client before generating a PDF report');
    }

    const { periodStart, periodEnd } = previousCalendarMonth();
    const queue = getReportQueue();
    const jobs: Array<{ customerId: string; jobId: string | undefined }> = [];

    for (const customerId of customerIds) {
      const payload: MonthlyReportJobData = {
        organizationId: scope.organizationId,
        customerId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      };
      const job = await queue.add(REPORT_JOB.generateMonthly, payload);
      jobs.push({ customerId, jobId: job.id });
    }

    return {
      queued: jobs.length,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      jobs,
    };
  },

  /**
   * Cron entry: enqueue generateMonthly with deliverEmail for every active client
   * on an org that includes the reports plan feature.
   */
  async enqueueScheduledMonthlyDeliveries() {
    const { periodStart, periodEnd } = previousCalendarMonth();
    const customers = await prisma.socialCustomer.findMany({
      where: {
        deletedAt: null,
        organization: { deletedAt: null, status: 'ACTIVE' },
      },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { plan: true } },
      },
    });

    const queue = getReportQueue();
    const jobs: Array<{ customerId: string; jobId: string | undefined }> = [];
    let skippedPlan = 0;

    for (const customer of customers) {
      if (!planOrDefault(customer.organization.plan).features.includes('reports')) {
        skippedPlan += 1;
        continue;
      }

      const payload: MonthlyReportJobData = {
        organizationId: customer.organizationId,
        customerId: customer.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        deliverEmail: true,
      };
      const job = await queue.add(REPORT_JOB.generateMonthly, payload, {
        jobId: `reports.monthly.${customer.id}.${periodStart.toISOString().slice(0, 7)}`,
      });
      jobs.push({ customerId: customer.id, jobId: job.id });
    }

    console.log(
      `[reports] scheduled monthly: queued=${jobs.length} skippedPlan=${skippedPlan} period=${periodStart.toISOString().slice(0, 7)}`
    );

    return {
      queued: jobs.length,
      skippedPlan,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      jobs,
    };
  },

  /** Kept for sync markdown fallback / manual calls; PDF path uses generateMonthlyPdf. */
  async generate(organizationId: string) {
    await planService.assertFeature(organizationId, 'reports');
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [posts, leads, threads] = await Promise.all([
      prisma.socialPost.count({
        where: { organizationId, state: 'PUBLISHED', publishDate: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.socialLead.count({ where: { organizationId, createdAt: { gte: periodStart } } }),
      prisma.socialInboxThread.count({ where: { organizationId, lastMessageAt: { gte: periodStart } } }),
    ]);
    const facts = `Published posts: ${posts}\nLeads: ${leads}\nInbox threads touched: ${threads}\nPeriod: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`;
    const scope = organizationScope(organizationId);

    let title = 'Monthly client report';
    let body = `# Monthly client report\n\n${facts}\n\nUse this as the agency summary until AI is configured.`;
    if (isClaudeConfigured()) {
      try {
        const written = await askClaude({
          scope,
          feature: 'client-report',
          schema: ReportFormat,
          task: 'Write a short monthly client report in plain markdown. Use only the numbers in the input. Do not invent metrics.',
          input: facts,
          effort: 'low',
        });
        title = written.title;
        body = written.body;
      } catch (error) {
        console.error('[reports] body generation failed', error);
      }
    }
    const narrative = await writeNarrative(scope, facts);

    const row = await prisma.socialClientReport.create({
      data: { organizationId, title, periodStart, periodEnd, body, narrative },
    });
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      narrative: row.narrative,
      pdfUrl: row.pdfUrl,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
    };
  },

  /** Worker entry: aggregates MySQL only, renders PDF, stores via media storage, saves SocialClientReport. */
  async generateMonthlyPdf(data: MonthlyReportJobData) {
    const { organizationId, customerId } = data;
    await planService.assertFeature(organizationId, 'reports');

    const period =
      data.periodStart && data.periodEnd
        ? { periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd) }
        : previousCalendarMonth();
    const { periodStart, periodEnd } = period;
    const scope: ClientScope = { organizationId, customerIds: [customerId] };
    const where = scopeWhere(scope);

    const [customer, organization, integrations, adAccounts] = await Promise.all([
      prisma.socialCustomer.findFirst({
        where: { id: customerId, organizationId, deletedAt: null },
        select: { id: true, name: true },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
      prisma.socialIntegration.findMany({
        where: { ...where, deletedAt: null },
        select: { id: true },
      }),
      prisma.adAccount.findMany({
        where,
        select: { id: true },
      }),
    ]);

    if (!customer) {
      throw new Error(`Client ${customerId} not found in organization ${organizationId}`);
    }

    const integrationIds = integrations.map((row) => row.id);
    const adAccountIds = adAccounts.map((row) => row.id);

    const [publishedPosts, leads, inboxThreads, insightRows, adAgg] = await Promise.all([
      prisma.socialPost.count({
        where: {
          ...where,
          state: 'PUBLISHED',
          publishDate: { gte: periodStart, lte: periodEnd },
        },
      }),
      prisma.socialLead.count({
        where: { ...where, createdAt: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.socialInboxThread.count({
        where: { ...where, lastMessageAt: { gte: periodStart, lte: periodEnd } },
      }),
      integrationIds.length === 0
        ? Promise.resolve([])
        : prisma.socialInsightDaily.groupBy({
            by: ['metric'],
            where: {
              integrationId: { in: integrationIds },
              date: { gte: periodStart, lte: periodEnd },
            },
            _sum: { value: true },
          }),
      adAccountIds.length === 0
        ? Promise.resolve(null)
        : prisma.adInsightDaily.aggregate({
            where: {
              adAccountId: { in: adAccountIds },
              level: 'campaign',
              date: { gte: periodStart, lte: periodEnd },
            },
            _sum: {
              spend: true,
              impressions: true,
              clicks: true,
              leads: true,
            },
          }),
    ]);

    const insightMap = new Map(
      insightRows.map((row) => [row.metric.toLowerCase(), toNumber(row._sum.value)])
    );
    const socialReach = insightMap.get('reach') ?? insightMap.get('page_impressions_unique') ?? 0;
    const socialImpressions =
      insightMap.get('impressions') ?? insightMap.get('page_impressions') ?? insightMap.get('views') ?? 0;

    const metrics = {
      publishedPosts,
      leads,
      inboxThreads,
      socialReach,
      socialImpressions,
      adSpend: toNumber(adAgg?._sum.spend),
      adImpressions: toNumber(adAgg?._sum.impressions),
      adClicks: toNumber(adAgg?._sum.clicks),
      adLeads: toNumber(adAgg?._sum.leads),
    };

    const facts = [
      `Client: ${customer.name}`,
      `Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`,
      `Published posts: ${metrics.publishedPosts}`,
      `Leads: ${metrics.leads}`,
      `Inbox threads: ${metrics.inboxThreads}`,
      `Social reach: ${metrics.socialReach}`,
      `Social impressions: ${metrics.socialImpressions}`,
      `Ad spend: ${metrics.adSpend}`,
      `Ad impressions: ${metrics.adImpressions}`,
      `Ad clicks: ${metrics.adClicks}`,
      `Ad leads: ${metrics.adLeads}`,
    ].join('\n');

    let title = `Monthly report — ${customer.name}`;
    let body = `Published posts: ${metrics.publishedPosts}. Leads: ${metrics.leads}. Inbox threads: ${metrics.inboxThreads}. Ad spend: ${metrics.adSpend}.`;
    if (isClaudeConfigured()) {
      try {
        const written = await askClaude({
          scope,
          feature: 'client-report',
          schema: ReportFormat,
          task: 'Write a short monthly client report in plain prose (no markdown headings). Use only the numbers in the input. Do not invent metrics.',
          input: facts,
          effort: 'low',
        });
        title = written.title;
        body = written.body;
      } catch (error) {
        console.error('[reports] body generation failed', error);
      }
    }
    const narrative = await writeNarrative(scope, facts);

    const { renderMonthlyClientReport } = await import('./report-pdf');
    const pdfBuffer = await renderMonthlyClientReport({
      clientName: customer.name,
      organizationName: organization?.name ?? 'Organization',
      title,
      periodLabel: periodLabel(periodStart, periodEnd),
      body,
      metrics,
    });

    const storage = getStorage();
    const stored = await storage.save(bufferToReadableStream(pdfBuffer), {
      extension: 'pdf',
      mimeType: 'application/pdf',
    });

    const row = await prisma.socialClientReport.create({
      data: {
        organizationId,
        customerId,
        title,
        periodStart,
        periodEnd,
        body,
        narrative,
        pdfUrl: stored.url,
      },
    });

    let emailDelivery: Awaited<ReturnType<typeof emailReportToApprovers>> | null = null;
    if (data.deliverEmail) {
      emailDelivery = await emailReportToApprovers({
        organizationId,
        customerId,
        clientName: customer.name,
        title: row.title,
        periodLabel: periodLabel(periodStart, periodEnd),
        pdfUrl: row.pdfUrl,
      });
    }

    return {
      id: row.id,
      title: row.title,
      narrative: row.narrative,
      pdfUrl: row.pdfUrl,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      emailDelivery,
    };
  },
};
