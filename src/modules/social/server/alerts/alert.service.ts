import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { socialSections } from '../../config/navigation';
import { notificationService } from '../notifications/notification.service';

const SLA_SWEEP_BATCH = 100;

export const alertService = {
  /** @deprecated Prefer notificationService.create with a typed SocialNotificationType. */
  async createNotification(organizationId: string, content: string, link?: string) {
    await notificationService.create({
      organizationId,
      type: 'alert',
      content,
      link,
    });
  },

  async evaluateOverspend() {
    const activeCampaigns = await prisma.adEntity.findMany({
      where: { level: 'campaign', status: 'ACTIVE', dailyBudget: { not: null } },
      select: {
        id: true,
        name: true,
        adAccountId: true,
        dailyBudget: true,
        externalId: true,
      },
    });

    if (activeCampaigns.length === 0) return;

    const accountIds = [...new Set(activeCampaigns.map((c) => c.adAccountId))];
    const accounts = await prisma.adAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, organizationId: true },
    });
    const orgByAccount = new Map(accounts.map((a) => [a.id, a.organizationId]));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const campaign of activeCampaigns) {
      const organizationId = orgByAccount.get(campaign.adAccountId);
      if (!organizationId || !campaign.dailyBudget) continue;

      const insight = await prisma.adInsightDaily.findFirst({
        where: { entityId: campaign.externalId, date: today },
      });
      if (!insight) continue;

      const spend = Number(insight.spend);
      const budget = Number(campaign.dailyBudget);
      if (budget <= 0) continue;

      // budget_80: today's spend has reached 80% of daily budget
      if (spend >= budget * 0.8) {
        const pct = Math.round((spend / budget) * 100);
        await notificationService.budget80(
          organizationId,
          `Campaign "${campaign.name}" has spent ${spend} today (${pct}% of daily budget ${budget}).`,
          socialSections.ads.href
        );
      }
    }
  },

  async evaluateAdFatigue() {
    // Placeholder — frequency / CTR drop rules land with F14.
  },

  /**
   * Find inbox threads past slaDueAt with no first response; notify once and
   * stamp slaBreachedAt. Criteria match inbox UI `overdue` badge.
   */
  async evaluateSlaBreaches(): Promise<{ breached: number }> {
    const now = new Date();
    const overdue = await prisma.socialInboxThread.findMany({
      where: {
        slaDueAt: { lt: now },
        firstResponseAt: null,
        slaBreachedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        contactName: true,
        platform: true,
        slaDueAt: true,
      },
      orderBy: { slaDueAt: 'asc' },
      take: SLA_SWEEP_BATCH,
    });

    if (overdue.length === 0) {
      return { breached: 0 };
    }

    let breached = 0;
    for (const thread of overdue) {
      const who = thread.contactName?.trim() || 'Unknown contact';
      const due = thread.slaDueAt?.toISOString() ?? 'unknown';
      try {
        await notificationService.slaBreached(
          thread.organizationId,
          `SLA breached: ${thread.platform} thread with ${who} (due ${due}).`,
          `${socialSections.inbox.href}?thread=${thread.id}`
        );
        await prisma.socialInboxThread.update({
          where: { id: thread.id },
          data: { slaBreachedAt: now },
        });
        breached += 1;
      } catch (err) {
        console.error(`[alerts] SLA notify failed for thread ${thread.id}`, err);
      }
    }

    if (breached > 0) {
      console.log(`[alerts] SLA sweep flagged ${breached} thread(s)`);
    }
    return { breached };
  },

  async runAllAlerts() {
    console.log('[alerts] Evaluating proactive agency alerts...');
    try {
      await this.evaluateOverspend();
      await this.evaluateAdFatigue();
    } catch (err) {
      console.error('[alerts] Evaluation failed', err);
    }
  },

  /** @deprecated Use reportService.generateMonthlyPdf via social-reports-queue. */
  async generateMonthlyReport(customerId: string) {
    console.log(
      `[reports] Delegating monthly PDF for customer ${customerId} — use REPORT_JOB.generateMonthly`
    );
  },
};
