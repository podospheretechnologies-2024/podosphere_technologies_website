import 'server-only';
import type { SocialWhatsAppAutoReply } from '@/generated/prisma/client';
import { organizationScope, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import {
  WHATSAPP_AUTO_REPLY_MATCH_TYPES,
  WHATSAPP_AUTO_REPLY_REPLY_TYPES,
  WHATSAPP_AUTO_REPLY_SENDER_LABEL,
  type WhatsAppAutoReplyMatchType,
  type WhatsAppAutoReplyReplyType,
} from '../../config/whatsapp-auto-reply';
import type { WhatsAppAutoReplyItem } from '../../types/whatsapp-auto-reply';
import { findMatchingAutoReply } from './auto-reply.match';
import { autoReplyRepository } from './auto-reply.repository';
import type { SaveWhatsAppAutoReplyBody } from './auto-reply.schema';
import { whatsappChatRepository } from './whatsapp-chat.repository';
import { whatsappService } from './whatsapp.service';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asDayArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6);
}

function asMatchType(value: string): WhatsAppAutoReplyMatchType {
  return (WHATSAPP_AUTO_REPLY_MATCH_TYPES as readonly string[]).includes(value)
    ? (value as WhatsAppAutoReplyMatchType)
    : 'keyword';
}

function asReplyType(value: string): WhatsAppAutoReplyReplyType {
  return (WHATSAPP_AUTO_REPLY_REPLY_TYPES as readonly string[]).includes(value)
    ? (value as WhatsAppAutoReplyReplyType)
    : 'text';
}

function toItem(row: SocialWhatsAppAutoReply): WhatsAppAutoReplyItem {
  return {
    id: row.id,
    name: row.name,
    matchType: asMatchType(row.matchType),
    pattern: row.pattern,
    caseSensitive: row.caseSensitive,
    replyType: asReplyType(row.replyType),
    replyText: row.replyText,
    templateName: row.templateName,
    templateLanguage: row.templateLanguage,
    templateVariables: asStringArray(row.templateVariables),
    businessHoursEnabled: row.businessHoursEnabled,
    businessHoursStart: row.businessHoursStart,
    businessHoursEnd: row.businessHoursEnd,
    businessHoursTimezone: row.businessHoursTimezone,
    businessHoursDays: asDayArray(row.businessHoursDays),
    priority: row.priority,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

async function findOrThrow(scope: ClientScope, id: string) {
  const row = await autoReplyRepository.findById(scope, id);
  if (!row) throw new HttpError(404, 'Auto-reply not found');
  return row;
}

export const autoReplyService = {
  async list(scope: ClientScope): Promise<WhatsAppAutoReplyItem[]> {
    return (await autoReplyRepository.list(scope)).map(toItem);
  },

  async create(scope: ClientScope, body: SaveWhatsAppAutoReplyBody): Promise<WhatsAppAutoReplyItem> {
    return toItem(
      await autoReplyRepository.create(scope.organizationId, customerIdForWrite(scope), body)
    );
  },

  async update(
    scope: ClientScope,
    id: string,
    body: SaveWhatsAppAutoReplyBody
  ): Promise<WhatsAppAutoReplyItem> {
    await findOrThrow(scope, id);
    return toItem(await autoReplyRepository.update(id, body));
  },

  async remove(scope: ClientScope, id: string): Promise<void> {
    await findOrThrow(scope, id);
    await autoReplyRepository.softDelete(id);
  },

  /**
   * Match + send before the inbound row is saved (F15).
   * Never throws to the webhook — failures are logged only.
   */
  async maybeReply(input: {
    organizationId: string;
    customerId: string | null;
    waId: string;
    body: string;
    /** Skip when STOP/opt-out or duplicate webhook delivery. */
    skip?: boolean;
  }): Promise<{ matched: boolean; ruleId?: string }> {
    if (input.skip || !input.body.trim()) {
      return { matched: false };
    }
    if (!whatsappService.isConfigured()) {
      return { matched: false };
    }

    try {
      const existing = await whatsappChatRepository.findConversation(
        input.organizationId,
        input.waId
      );
      if (existing?.optedOutAt) {
        return { matched: false };
      }

      const rules = await autoReplyRepository.listActiveForInbound(
        input.organizationId,
        input.customerId
      );
      const matched = findMatchingAutoReply(rules, input.body);
      if (!matched) {
        return { matched: false };
      }

      const scope = organizationScope(input.organizationId, input.customerId);
      if (matched.replyType === 'template') {
        if (!matched.templateName || !matched.templateLanguage) {
          return { matched: false };
        }
        await whatsappService.send(
          scope,
          {
            type: 'template',
            to: input.waId,
            templateName: matched.templateName,
            language: matched.templateLanguage,
            variables: asStringArray(matched.templateVariables),
          },
          { senderName: WHATSAPP_AUTO_REPLY_SENDER_LABEL }
        );
      } else {
        const text = matched.replyText?.trim();
        if (!text) {
          return { matched: false };
        }
        await whatsappService.send(
          scope,
          { type: 'text', to: input.waId, text },
          { senderName: WHATSAPP_AUTO_REPLY_SENDER_LABEL }
        );
      }

      return { matched: true, ruleId: matched.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`[whatsapp] auto-reply failed waId=${input.waId}: ${message}`);
      return { matched: false };
    }
  },
};
