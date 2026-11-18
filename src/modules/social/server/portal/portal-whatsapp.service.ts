import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { ClientScope } from '@/shared/server/client-scope';
import type { PortalSession } from '../approvals/approval.service';
import { orderFlowService } from '../whatsapp/order-flow.service';

export type PortalWhatsAppSummary = {
  numbers: { displayPhone: string | null; businessName: string | null }[];
  leadsMessaged: number;
  replies: number;
  broadcastsSent: number;
  /** Order-flow recovery KPIs (last 30 days, read-only). */
  orderFlows: {
    messagesSent: number;
    cartsRecovered: number;
    revenueRecovered: number;
    moneySpentEstimate: number;
  } | null;
};

/**
 * Client-portal WhatsApp metrics: session org + customer only.
 * No access tokens, phone_number_id, or other clients.
 */
export const portalWhatsAppService = {
  async summary(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalWhatsAppSummary> {
    const { organizationId, customerId } = session;
    const scope: ClientScope = { organizationId, customerIds: [customerId] };
    const [connections, leadsMessaged, replies, broadcasts, orderResults] = await Promise.all([
      prisma.socialWhatsAppConnection.findMany({
        where: { organizationId, customerId },
        select: { displayPhone: true, businessName: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.socialLead.count({
        where: { organizationId, customerId, waStep: { gt: 0 } },
      }),
      prisma.socialLead.count({
        where: { organizationId, customerId, waRepliedAt: { not: null } },
      }),
      prisma.whatsAppBroadcast.aggregate({
        where: {
          organizationId,
          customerId,
          status: { in: ['sent', 'partial'] },
        },
        _sum: { sentCount: true },
      }),
      orderFlowService.results(scope, {}).catch(() => null),
    ]);

    return {
      numbers: connections.map((row) => ({
        displayPhone: row.displayPhone,
        businessName: row.businessName,
      })),
      leadsMessaged,
      replies,
      broadcastsSent: broadcasts._sum.sentCount ?? 0,
      orderFlows: orderResults
        ? {
            messagesSent: orderResults.messagesSent,
            cartsRecovered: orderResults.cartsRecovered,
            revenueRecovered: orderResults.revenueRecovered,
            moneySpentEstimate: orderResults.moneySpentEstimate,
          }
        : {
            messagesSent: 0,
            cartsRecovered: 0,
            revenueRecovered: 0,
            moneySpentEstimate: 0,
          },
    };
  },
};
