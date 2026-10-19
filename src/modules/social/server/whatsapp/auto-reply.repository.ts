import 'server-only';
import type { SocialWhatsAppAutoReply } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import type { SaveWhatsAppAutoReplyBody } from './auto-reply.schema';

type WriteData = SaveWhatsAppAutoReplyBody;

function toDb(data: WriteData) {
  return {
    name: data.name,
    matchType: data.matchType,
    pattern: data.pattern,
    caseSensitive: data.caseSensitive,
    replyType: data.replyType,
    replyText: data.replyType === 'text' ? data.replyText ?? null : null,
    templateName: data.replyType === 'template' ? data.templateName ?? null : null,
    templateLanguage: data.replyType === 'template' ? data.templateLanguage ?? null : null,
    templateVariables: data.replyType === 'template' ? data.templateVariables : [],
    businessHoursEnabled: data.businessHoursEnabled,
    businessHoursStart: data.businessHoursEnabled ? (data.businessHoursStart ?? null) : null,
    businessHoursEnd: data.businessHoursEnabled ? (data.businessHoursEnd ?? null) : null,
    businessHoursTimezone: data.businessHoursEnabled
      ? (data.businessHoursTimezone ?? null)
      : null,
    businessHoursDays: data.businessHoursEnabled ? data.businessHoursDays : [],
    priority: data.priority,
    active: data.active,
  };
}

export const autoReplyRepository = {
  list(scope: ClientScope): Promise<SocialWhatsAppAutoReply[]> {
    return prisma.socialWhatsAppAutoReply.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  },

  findById(scope: ClientScope, id: string): Promise<SocialWhatsAppAutoReply | null> {
    return prisma.socialWhatsAppAutoReply.findFirst({
      where: { id, ...scopeWhere(scope), deletedAt: null },
    });
  },

  /** Agency-wide (null) + matching client rules for webhook matching. */
  listActiveForInbound(
    organizationId: string,
    customerId: string | null
  ): Promise<SocialWhatsAppAutoReply[]> {
    return prisma.socialWhatsAppAutoReply.findMany({
      where: {
        organizationId,
        active: true,
        deletedAt: null,
        OR: customerId
          ? [{ customerId: null }, { customerId }]
          : [{ customerId: null }],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  },

  create(
    organizationId: string,
    customerId: string | null,
    data: WriteData
  ): Promise<SocialWhatsAppAutoReply> {
    return prisma.socialWhatsAppAutoReply.create({
      data: { organizationId, customerId, ...toDb(data) },
    });
  },

  update(id: string, data: WriteData): Promise<SocialWhatsAppAutoReply> {
    return prisma.socialWhatsAppAutoReply.update({
      where: { id },
      data: toDb(data),
    });
  },

  softDelete(id: string): Promise<SocialWhatsAppAutoReply> {
    return prisma.socialWhatsAppAutoReply.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  },
};
