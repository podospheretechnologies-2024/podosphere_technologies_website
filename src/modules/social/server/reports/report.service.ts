import 'server-only';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { isClaudeConfigured, askClaude } from '../ai/claude.client';
import { planService } from '../billing/plan.service';

const ReportFormat = z.object({
  title: z.string(),
  body: z.string(),
});

export const reportService = {
  async list(organizationId: string) {
    const rows = await prisma.socialClientReport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    }));
  },

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

    let title = 'Monthly client report';
    let body = `# Monthly client report\n\n${facts}\n\nUse this as the agency summary until AI is configured.`;
    if (isClaudeConfigured()) {
      const written = await askClaude({
        organizationId,
        feature: 'client-report',
        schema: ReportFormat,
        task: 'Write a short monthly client report in plain markdown. Use only the numbers in the input. Do not invent metrics.',
        input: facts,
        effort: 'low',
      });
      title = written.title;
      body = written.body;
    }

    const row = await prisma.socialClientReport.create({
      data: { organizationId, title, periodStart, periodEnd, body },
    });
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
    };
  },
};
