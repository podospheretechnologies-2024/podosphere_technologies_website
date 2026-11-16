import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { PortalSession } from '../approvals/approval.service';

export type PortalWhatsAppSummary = {
  numbers: { displayPhone: string | null; businessName: string | null }[];
  leadsMessaged: number;
  replies: number;
  broadcastsSent: number;
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
    const [connections, leadsMessaged, replies, broadcasts] = await Promise.all([
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
    ]);

    return {
      numbers: connections.map((row) => ({
        displayPhone: row.displayPhone,
        businessName: row.businessName,
      })),
      leadsMessaged,
      replies,
      broadcastsSent: broadcasts._sum.sentCount ?? 0,
    };
  },
};
