import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { PortalSession } from '../approvals/approval.service';

export type PortalPlugAutoReply = {
  id: string;
  name: string;
  matchType: string;
  pattern: string;
  caseSensitive: boolean;
  replyType: string;
  replyText: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  businessHoursEnabled: boolean;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  businessHoursTimezone: string | null;
  priority: number;
  active: boolean;
};

export type PortalPlugAutoPost = {
  id: string;
  title: string;
  active: boolean;
};

export type PortalPlugsSummary = {
  autoReplies: PortalPlugAutoReply[];
  autoPosts: PortalPlugAutoPost[];
};

/**
 * Client-portal Plugs (view): WhatsApp auto-replies + RSS/auto-posts for this customer.
 * No tokens, template variables, integration ids, feed URLs, or other clients.
 * Org-wide rules (customerId null) are excluded.
 */
export const portalPlugsService = {
  async list(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalPlugsSummary> {
    const { organizationId, customerId } = session;

    const [autoReplies, autoPosts] = await Promise.all([
      prisma.socialWhatsAppAutoReply.findMany({
        where: {
          organizationId,
          customerId,
          deletedAt: null,
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        take: 100,
        select: {
          id: true,
          name: true,
          matchType: true,
          pattern: true,
          caseSensitive: true,
          replyType: true,
          replyText: true,
          templateName: true,
          templateLanguage: true,
          businessHoursEnabled: true,
          businessHoursStart: true,
          businessHoursEnd: true,
          businessHoursTimezone: true,
          priority: true,
          active: true,
        },
      }),
      prisma.socialAutoPost.findMany({
        where: {
          organizationId,
          customerId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          active: true,
        },
      }),
    ]);

    return {
      autoReplies: autoReplies.map((row) => ({
        id: row.id,
        name: row.name,
        matchType: row.matchType,
        pattern: row.pattern,
        caseSensitive: row.caseSensitive,
        replyType: row.replyType,
        replyText: row.replyText,
        templateName: row.templateName,
        templateLanguage: row.templateLanguage,
        businessHoursEnabled: row.businessHoursEnabled,
        businessHoursStart: row.businessHoursStart,
        businessHoursEnd: row.businessHoursEnd,
        businessHoursTimezone: row.businessHoursTimezone,
        priority: row.priority,
        active: row.active,
      })),
      autoPosts: autoPosts.map((row) => ({
        id: row.id,
        title: row.title,
        active: row.active,
      })),
    };
  },
};
