import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

export type WhatsAppMessageSource = 'customer' | 'podosocial' | 'podocrm' | 'unknown';

export interface UpsertConversationInput {
  organizationId: string;
  /** Set when the connection/client is known (webhook / scoped send). */
  customerId?: string | null;
  waId: string;
  contactName?: string | null;
  preview: string;
  timestamp: Date;
  inbound: boolean;
}

export interface CreateMessageInput {
  organizationId: string;
  conversationId: string;
  wamid?: string | null;
  direction: 'inbound' | 'outbound';
  type?: string;
  body: string;
  status?: string | null;
  source?: WhatsAppMessageSource | null;
  senderLabel?: string | null;
  timestamp: Date;
}

export const whatsappChatRepository = {
  listConversations(scope: ClientScope) {
    return prisma.whatsAppConversation.findMany({
      where: scopeWhere(scope),
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    });
  },

  findConversation(organizationId: string, waId: string) {
    return prisma.whatsAppConversation.findUnique({
      where: { organizationId_waId: { organizationId, waId } },
    });
  },

  findConversationById(scope: ClientScope, id: string) {
    return prisma.whatsAppConversation.findFirst({
      where: { id, ...scopeWhere(scope) },
    });
  },

  listMessages(organizationId: string, conversationId: string) {
    return prisma.whatsAppMessage.findMany({
      where: { organizationId, conversationId },
      orderBy: { timestamp: 'asc' },
      take: 500,
    });
  },

  /** Most recent messages across chats (for PodoCRM history backfill), oldest→newest. */
  async listRecentWithConversation(organizationId: string, take = 400) {
    const rows = await prisma.whatsAppMessage.findMany({
      where: { organizationId },
      include: {
        conversation: { select: { waId: true, contactName: true } },
      },
      orderBy: { timestamp: 'desc' },
      take,
    });
    return rows.reverse();
  },

  async upsertConversation(input: UpsertConversationInput) {
    const existing = await prisma.whatsAppConversation.findUnique({
      where: {
        organizationId_waId: { organizationId: input.organizationId, waId: input.waId },
      },
    });

    if (existing) {
      return prisma.whatsAppConversation.update({
        where: { id: existing.id },
        data: {
          contactName: input.contactName ?? existing.contactName,
          customerId: existing.customerId ?? input.customerId ?? null,
          lastMessageAt: input.timestamp,
          lastInboundAt: input.inbound ? input.timestamp : existing.lastInboundAt,
          lastPreview: input.preview.slice(0, 500),
          unreadCount: input.inbound ? existing.unreadCount + 1 : existing.unreadCount,
        },
      });
    }

    return prisma.whatsAppConversation.create({
      data: {
        organizationId: input.organizationId,
        customerId: input.customerId ?? null,
        waId: input.waId,
        contactName: input.contactName ?? null,
        lastMessageAt: input.timestamp,
        lastInboundAt: input.inbound ? input.timestamp : null,
        lastPreview: input.preview.slice(0, 500),
        unreadCount: input.inbound ? 1 : 0,
      },
    });
  },

  async createMessage(input: CreateMessageInput) {
    if (input.wamid) {
      const existing = await prisma.whatsAppMessage.findUnique({ where: { wamid: input.wamid } });
      if (existing) {
        const needsSource = !existing.source && input.source;
        const needsSender = !existing.senderLabel && input.senderLabel;
        if (needsSource || needsSender) {
          return prisma.whatsAppMessage.update({
            where: { id: existing.id },
            data: {
              source: needsSource ? input.source : existing.source,
              senderLabel: needsSender ? input.senderLabel : existing.senderLabel,
            },
          });
        }
        return existing;
      }
    }
    return prisma.whatsAppMessage.create({
      data: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        wamid: input.wamid ?? null,
        direction: input.direction,
        type: input.type ?? 'text',
        body: input.body,
        status: input.status ?? null,
        source: input.source ?? null,
        senderLabel: input.senderLabel?.slice(0, 191) ?? null,
        timestamp: input.timestamp,
      },
    });
  },

  markRead(scope: ClientScope, conversationId: string) {
    return prisma.whatsAppConversation.updateMany({
      where: { id: conversationId, ...scopeWhere(scope) },
      data: { unreadCount: 0 },
    });
  },

  updateMessageStatus(wamid: string, status: string) {
    return prisma.whatsAppMessage.updateMany({
      where: { wamid },
      data: { status },
    });
  },
};
