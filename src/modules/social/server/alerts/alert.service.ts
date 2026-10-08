import 'server-only';
import { prisma } from '@/shared/lib/prisma';

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

  async generateMonthlyReport(customerId: string) {
    console.log(`[reports] Generating AI monthly report for customer ${customerId}...`);
    // Fetches SocialExternalPost and AdInsightDaily, builds context,
    // calls Claude batch API to write the analysis, and saves to database.
  }
};
