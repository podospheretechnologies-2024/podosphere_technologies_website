import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { socialSections } from '../../config/navigation';

const SLA_SWEEP_BATCH = 100;

export const alertService = {
  async createNotification(organizationId: string, content: string, link?: string) {
    await prisma.socialNotification.create({
      data: {
        organizationId,
        content,
        link,
      }
    });
    // In the future, emit webhooks or send a WhatsApp template to the account manager
  },

  async evaluateOverspend() {
    const activeCampaigns = await prisma.adEntity.findMany({
      where: { level: 'campaign', status: 'ACTIVE', dailyBudget: { not: null } }
    });

    for (const campaign of activeCampaigns) {
      // Find today's insight
      const today = new Date();
      today.setUTCHours(0,0,0,0);

      const insight = await prisma.adInsightDaily.findFirst({
        where: { entityId: campaign.externalId, date: today }
      });

      if (insight && campaign.dailyBudget) {
        const spend = Number(insight.spend);
        const budget = Number(campaign.dailyBudget);
        
        // Alert if today's spend > 120% of the daily budget
        if (spend > budget * 1.2) {
          await this.createNotification(
            campaign.adAccountId, // Note: Need organization mapping, using AdAccount
            `High Spend Alert: Campaign "${campaign.name}" has spent ${spend} today, which is over 120% of its daily budget.`
          );
        }
      }
    }
  },

  async evaluateAdFatigue() {
    const recentInsights = await prisma.adInsightDaily.findMany({
      where: { level: 'ad', date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { date: 'desc' }
    });
    // Pseudo logic for calculating fatigue across 7 days
    // When frequency > 3 and CTR drops > 30%...
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
        await this.createNotification(
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
      // evaluateSpendWithNoLeads()
      // evaluateChannelBroken()
    } catch (err) {
      console.error('[alerts] Evaluation failed', err);
    }
  },

  /** @deprecated Use reportService.generateMonthlyPdf via social-reports-queue. */
  async generateMonthlyReport(customerId: string) {
    console.log(`[reports] Delegating monthly PDF for customer ${customerId} — use REPORT_JOB.generateMonthly`);
  }
};
