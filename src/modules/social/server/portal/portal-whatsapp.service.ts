import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { logAudit } from '@/shared/server/audit.service';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import {
  parsePortalTabsConfig,
  portalWhatsAppBroadcastNeedsApproval,
  portalWhatsAppDailyCap,
} from '../../config/portal-tabs';
import type { PortalSession } from '../approvals/approval.service';
import { orderFlowService } from '../whatsapp/order-flow.service';
import { leadWhatsAppService } from '../whatsapp/lead-whatsapp.service';
import {
  broadcastService,
  whatsappOnboardingService,
} from '../whatsapp/whatsapp-growth.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { portalPlugsService } from './portal-plugs.service';

export type PortalWhatsAppNumberCard = {
  displayPhone: string | null;
  businessName: string | null;
  qualityRating: string | null;
  messagingLimitTier: string | null;
};

export type PortalWhatsAppStats30d = {
  sent: number;
  delivered: number;
  replied: number;
};

export type PortalWhatsAppOrderFlows = {
  days: 7 | 30;
  messagesSent: number;
  cartsRecovered: number;
  revenueRecovered: number;
  moneySpentEstimate: number;
};

export type PortalWhatsAppSummary = {
  connected: boolean;
  number: PortalWhatsAppNumberCard | null;
  stats30d: PortalWhatsAppStats30d;
  leadsMessaged: number;
  replies: number;
  broadcastsSent: number;
  dailyCap: number;
  sendsUsedToday: number;
  /** When true, client-prepared broadcasts wait for agency approval. */
  broadcastNeedsApproval: boolean;
  /** Order-flow recovery KPIs (7 or 30 days, read-only). */
  orderFlows: PortalWhatsAppOrderFlows | null;
};

export type PortalWhatsAppBroadcastRow = {
  id: string;
  name: string;
  templateName: string;
  language: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  createdAt: string;
};

export type PortalWhatsAppAutomation = {
  autoReplies: {
    id: string;
    name: string;
    matchType: string;
    pattern: string;
    replyType: string;
    active: boolean;
  }[];
  leadFlow: {
    enabled: boolean;
    welcomeTemplate: string | null;
    followUp1Template: string | null;
    followUp2Template: string | null;
  };
};

export type PortalWhatsAppConversationRow = {
  id: string;
  contactName: string | null;
  contactPhone: string;
  lastMessageAt: string;
  lastPreview: string | null;
  unreadCount: number;
  withinWindow: boolean;
};

export type PortalWhatsAppMessageRow = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string | null;
  timestamp: string;
};

export type PortalWhatsAppConversationDetail = {
  conversation: PortalWhatsAppConversationRow;
  messages: PortalWhatsAppMessageRow[];
};

export type PortalWhatsAppTemplateRow = {
  name: string;
  language: string;
  category: string;
  bodyPreview: string;
  variablesCount: number;
  variables: string[];
};

export type PortalWhatsAppSendResult = {
  messageId: string;
  sendsUsedToday: number;
  dailyCap: number;
};

function portalScope(session: Pick<PortalSession, 'organizationId' | 'customerId'>): ClientScope {
  return { organizationId: session.organizationId, customerIds: [session.customerId] };
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function withinWindow(lastInboundAt: Date | null | undefined): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
}

function mapConversation(row: {
  id: string;
  waId: string;
  contactName: string | null;
  lastMessageAt: Date | string;
  lastInboundAt?: Date | string | null;
  lastPreview: string | null;
  unreadCount: number;
  withinWindow?: boolean;
}): PortalWhatsAppConversationRow {
  const lastInbound =
    row.lastInboundAt == null
      ? null
      : typeof row.lastInboundAt === 'string'
        ? new Date(row.lastInboundAt)
        : row.lastInboundAt;
  return {
    id: row.id,
    contactName: row.contactName,
    contactPhone: row.waId,
    lastMessageAt:
      typeof row.lastMessageAt === 'string'
        ? row.lastMessageAt
        : row.lastMessageAt.toISOString(),
    lastPreview: row.lastPreview,
    unreadCount: row.unreadCount,
    withinWindow:
      typeof row.withinWindow === 'boolean' ? row.withinWindow : withinWindow(lastInbound),
  };
}

async function loadPortalTabsConfig(
  session: Pick<PortalSession, 'organizationId' | 'customerId'>
) {
  const customer = await prisma.socialCustomer.findFirst({
    where: {
      id: session.customerId,
      organizationId: session.organizationId,
      deletedAt: null,
    },
    select: { portalTabs: true },
  });
  return parsePortalTabsConfig(customer?.portalTabs);
}

async function loadDailyCap(
  session: Pick<PortalSession, 'organizationId' | 'customerId'>
): Promise<number> {
  return portalWhatsAppDailyCap(await loadPortalTabsConfig(session));
}

async function loadBroadcastNeedsApproval(
  session: Pick<PortalSession, 'organizationId' | 'customerId'>
): Promise<boolean> {
  return portalWhatsAppBroadcastNeedsApproval(await loadPortalTabsConfig(session));
}

function normalizeOrderDays(days?: number | null): 7 | 30 {
  return days === 7 ? 7 : 30;
}

async function countSendsToday(
  session: Pick<PortalSession, 'organizationId' | 'customerId'>
): Promise<number> {
  return prisma.whatsAppMessage.count({
    where: {
      organizationId: session.organizationId,
      direction: 'outbound',
      timestamp: { gte: startOfUtcDay() },
      conversation: { customerId: session.customerId },
    },
  });
}

async function assertUnderDailyCap(
  session: PortalSession,
  needed = 1
): Promise<{
  dailyCap: number;
  sendsUsedToday: number;
  remaining: number;
}> {
  const [dailyCap, sendsUsedToday] = await Promise.all([
    loadDailyCap(session),
    countSendsToday(session),
  ]);
  const remaining = Math.max(0, dailyCap - sendsUsedToday);
  if (needed > remaining) {
    throw new HttpError(
      429,
      remaining === 0
        ? `Daily WhatsApp send limit of ${dailyCap} reached. Try again tomorrow or ask your agency to raise the cap.`
        : `Only ${remaining} send${remaining === 1 ? '' : 's'} left today (cap ${dailyCap}). Reduce the recipient list or ask your agency to raise the cap.`
    );
  }
  return { dailyCap, sendsUsedToday, remaining };
}

async function senderLabelFor(session: PortalSession): Promise<string> {
  const approver = await prisma.clientApprover.findFirst({
    where: {
      id: session.approverId,
      organizationId: session.organizationId,
      customerId: session.customerId,
    },
    select: { name: true, email: true },
  });
  return approver?.name?.trim() || approver?.email || 'Client portal';
}

/**
 * Client-portal WhatsApp: session org + customer only.
 * No access tokens, phone_number_id, waba ids, staff notes, or other clients.
 */
export const portalWhatsAppService = {
  async summary(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    options?: { days?: number | null }
  ): Promise<PortalWhatsAppSummary> {
    const { organizationId, customerId } = session;
    const scope = portalScope(session);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const orderDays = normalizeOrderDays(options?.days);
    const orderFrom = new Date(Date.now() - orderDays * 24 * 60 * 60 * 1000);

    const [
      connection,
      overview,
      metaStats,
      replied30d,
      leadsMessaged,
      replies,
      broadcasts,
      orderResults,
      tabsConfig,
      sendsUsedToday,
    ] = await Promise.all([
      prisma.socialWhatsAppConnection.findFirst({
        where: { organizationId, customerId },
        select: { displayPhone: true, businessName: true },
        orderBy: { createdAt: 'asc' },
      }),
      whatsappService.overview(scope).catch(() => null),
      whatsappOnboardingService.messageStats(scope, 30).catch(() => ({
        status: 'ERROR' as const,
      })),
      prisma.whatsAppMessage.count({
        where: {
          organizationId,
          direction: 'inbound',
          timestamp: { gte: since },
          conversation: { customerId },
        },
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
      orderFlowService
        .results(scope, { from: orderFrom.toISOString() })
        .catch(() => null),
      loadPortalTabsConfig(session),
      countSendsToday(session),
    ]);

    const numberFromOverview = overview?.number
      ? {
          displayPhone: overview.number.displayPhoneNumber,
          businessName: overview.number.verifiedName,
          qualityRating: overview.number.qualityRating,
          messagingLimitTier: overview.number.messagingLimitTier,
        }
      : null;

    const number: PortalWhatsAppNumberCard | null = numberFromOverview ??
      (connection
        ? {
            displayPhone: connection.displayPhone,
            businessName: connection.businessName,
            qualityRating: null,
            messagingLimitTier: null,
          }
        : null);

    const stats30d: PortalWhatsAppStats30d = {
      sent: metaStats.status === 'OK' ? metaStats.sent : 0,
      delivered: metaStats.status === 'OK' ? metaStats.delivered : 0,
      replied: replied30d,
    };

    return {
      connected: Boolean(connection || overview?.configured),
      number,
      stats30d,
      leadsMessaged,
      replies,
      broadcastsSent: broadcasts._sum.sentCount ?? 0,
      dailyCap: portalWhatsAppDailyCap(tabsConfig),
      sendsUsedToday,
      broadcastNeedsApproval: portalWhatsAppBroadcastNeedsApproval(tabsConfig),
      orderFlows: orderResults
        ? {
            days: orderDays,
            messagesSent: orderResults.messagesSent,
            cartsRecovered: orderResults.cartsRecovered,
            revenueRecovered: orderResults.revenueRecovered,
            moneySpentEstimate: orderResults.moneySpentEstimate,
          }
        : {
            days: orderDays,
            messagesSent: 0,
            cartsRecovered: 0,
            revenueRecovered: 0,
            moneySpentEstimate: 0,
          },
    };
  },

  async listConversations(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<{ conversations: PortalWhatsAppConversationRow[] }> {
    const rows = await whatsappService.listConversations(portalScope(session));
    return {
      conversations: rows.map((row) =>
        mapConversation({
          id: row.id,
          waId: row.waId,
          contactName: row.contactName,
          lastMessageAt: row.lastMessageAt,
          lastInboundAt: row.lastInboundAt,
          lastPreview: row.lastPreview,
          unreadCount: row.unreadCount,
          withinWindow: row.withinWindow,
        })
      ),
    };
  },

  async getConversation(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    conversationId: string
  ): Promise<PortalWhatsAppConversationDetail> {
    const detail = await whatsappService.getConversation(portalScope(session), conversationId);
    return {
      conversation: mapConversation({
        id: detail.conversation.id,
        waId: detail.conversation.waId,
        contactName: detail.conversation.contactName,
        lastMessageAt: detail.conversation.lastMessageAt,
        lastInboundAt: detail.conversation.lastInboundAt,
        lastPreview: detail.conversation.lastPreview,
        unreadCount: detail.conversation.unreadCount,
        withinWindow: detail.conversation.withinWindow,
      }),
      messages: detail.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        body: message.body,
        status: message.status,
        timestamp: message.timestamp,
      })),
    };
  },

  async listTemplates(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<{ templates: PortalWhatsAppTemplateRow[] }> {
    const templates = await whatsappService.templates(portalScope(session));
    return {
      templates: templates
        .filter((template) => template.status === 'APPROVED' && !template.unsupportedReason)
        .map((template) => ({
          name: template.name,
          language: template.language,
          category: template.category,
          bodyPreview: template.body.slice(0, 280),
          variablesCount: template.variables.length,
          variables: template.variables,
        })),
    };
  },

  /**
   * Reply inside the 24h customer-care window.
   * Call only from routes that already passed requirePortalTab('whatsapp', 'act').
   */
  async reply(
    session: PortalSession,
    conversationId: string,
    text: string
  ): Promise<{
    conversation: PortalWhatsAppConversationRow;
    message: PortalWhatsAppMessageRow;
    sendsUsedToday: number;
    dailyCap: number;
  }> {
    const trimmed = text.trim();
    if (!trimmed) throw new HttpError(400, 'Write a message');

    const { dailyCap } = await assertUnderDailyCap(session);
    const before = await this.getConversation(session, conversationId);
    if (!before.conversation.withinWindow) {
      throw new HttpError(
        422,
        'This person has not messaged you in the last 24 hours. Send an approved template instead.'
      );
    }

    const scope = portalScope(session);
    const senderName = await senderLabelFor(session);
    const result = await whatsappService.send(
      scope,
      { type: 'text', to: before.conversation.contactPhone, text: trimmed },
      { senderName }
    );

    await logAudit({
      action: 'portal.whatsapp.reply',
      targetType: 'whatsapp_conversation',
      targetId: conversationId,
      metadata: {
        customerId: session.customerId,
        approverId: session.approverId,
        messageId: result.messageId,
      },
    });

    const after = await this.getConversation(session, conversationId);
    const lastOutbound = [...after.messages].reverse().find((row) => row.direction === 'outbound');
    const sendsUsedToday = await countSendsToday(session);

    return {
      conversation: after.conversation,
      message: lastOutbound ?? {
        id: result.messageId || `out-${Date.now()}`,
        direction: 'outbound',
        body: trimmed,
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
      sendsUsedToday,
      dailyCap,
    };
  },

  /**
   * Send one approved template to one phone.
   * Call only from routes that already passed requirePortalTab('whatsapp', 'act').
   */
  async sendTemplate(
    session: PortalSession,
    input: {
      to: string;
      templateName: string;
      language: string;
      variables: string[];
    }
  ): Promise<PortalWhatsAppSendResult> {
    const { dailyCap } = await assertUnderDailyCap(session);
    const scope = portalScope(session);
    const templates = await this.listTemplates(session);
    const match = templates.templates.find(
      (row) => row.name === input.templateName && row.language === input.language
    );
    if (!match) throw new HttpError(404, 'Template not found or not approved');
    if (match.variablesCount !== input.variables.length) {
      throw new HttpError(400, `This template needs ${match.variablesCount} variable(s)`);
    }

    const senderName = await senderLabelFor(session);
    const result = await whatsappService.send(
      scope,
      {
        type: 'template',
        to: input.to,
        templateName: input.templateName,
        language: input.language,
        variables: input.variables,
      },
      { senderName }
    );

    await logAudit({
      action: 'portal.whatsapp.template_send',
      targetType: 'whatsapp_template',
      targetId: `${input.templateName}:${input.language}`,
      metadata: {
        customerId: session.customerId,
        approverId: session.approverId,
        messageId: result.messageId,
        to: input.to,
        templateName: input.templateName,
        language: input.language,
      },
    });

    return {
      messageId: result.messageId,
      sendsUsedToday: await countSendsToday(session),
      dailyCap,
    };
  },

  async listBroadcasts(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<{ broadcasts: PortalWhatsAppBroadcastRow[] }> {
    const rows = await broadcastService.list(portalScope(session));
    return {
      broadcasts: rows.map((row) => ({
        id: row.id,
        name: row.name,
        templateName: row.templateName,
        language: row.language,
        status: row.status,
        recipientCount: row.recipientCount,
        sentCount: row.sentCount,
        createdAt: row.createdAt,
      })),
    };
  },

  /**
   * Client prepares a broadcast. When approval is required (default), status is
   * pending_approval and nothing is sent to Meta. When approval is off, sends
   * immediately under the daily cap.
   * Call only from routes that already passed requirePortalTab('whatsapp', 'act').
   */
  async createBroadcast(
    session: PortalSession,
    input: {
      name: string;
      templateName: string;
      language: string;
      phones: string[];
      variables: string[];
      consentAcknowledged: true;
    }
  ) {
    const scope = portalScope(session);
    const templates = await this.listTemplates(session);
    const match = templates.templates.find(
      (row) => row.name === input.templateName && row.language === input.language
    );
    if (!match) throw new HttpError(404, 'Template not found or not approved');
    if (match.variablesCount !== input.variables.length) {
      throw new HttpError(400, `This template needs ${match.variablesCount} variable(s)`);
    }

    const phoneCount = [
      ...new Set(input.phones.map((phone) => phone.replace(/\D/g, '')).filter(Boolean)),
    ].length;
    if (phoneCount === 0) throw new HttpError(400, 'Add at least one phone number');

    const needsApproval = await loadBroadcastNeedsApproval(session);
    await assertUnderDailyCap(session, phoneCount);

    if (needsApproval) {
      const created = await broadcastService.createPending(scope, {
        name: input.name,
        templateName: input.templateName,
        language: input.language,
        phones: input.phones,
        variables: input.variables,
        consentAcknowledged: true,
      });
      await logAudit({
        action: 'portal.whatsapp.broadcast_submit',
        targetType: 'whatsapp_broadcast',
        targetId: created.id,
        metadata: {
          customerId: session.customerId,
          approverId: session.approverId,
          recipientCount: created.recipientCount,
          templateName: input.templateName,
          needsApproval: true,
        },
      });
      return {
        ...created,
        sendsUsedToday: await countSendsToday(session),
        dailyCap: await loadDailyCap(session),
      };
    }

    const sent = await broadcastService.send(scope, {
      name: input.name,
      templateName: input.templateName,
      language: input.language,
      phones: input.phones,
      variables: input.variables,
      consentAcknowledged: true,
    });
    await logAudit({
      action: 'portal.whatsapp.broadcast_send',
      targetType: 'whatsapp_broadcast',
      targetId: sent.id,
      metadata: {
        customerId: session.customerId,
        approverId: session.approverId,
        sent: sent.sent,
        total: sent.total,
        templateName: input.templateName,
        needsApproval: false,
      },
    });
    return {
      ...sent,
      status: 'sent' as const,
      recipientCount: sent.total,
      sendsUsedToday: await countSendsToday(session),
      dailyCap: await loadDailyCap(session),
    };
  },

  /**
   * Auto-reply rules + lead-flow status for this client's number (view only).
   * Portal-safe: no tokens, alert phones, or other clients.
   */
  async automation(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalWhatsAppAutomation> {
    const [plugs, leadFlow] = await Promise.all([
      portalPlugsService.list(session),
      leadWhatsAppService.getFlow(portalScope(session)),
    ]);
    return {
      autoReplies: plugs.autoReplies.map((rule) => ({
        id: rule.id,
        name: rule.name,
        matchType: rule.matchType,
        pattern: rule.pattern,
        replyType: rule.replyType,
        active: rule.active,
      })),
      leadFlow: {
        enabled: leadFlow.enabled,
        welcomeTemplate: leadFlow.welcomeTemplate,
        followUp1Template: leadFlow.followUp1Template,
        followUp2Template: leadFlow.followUp2Template,
      },
    };
  },
};
