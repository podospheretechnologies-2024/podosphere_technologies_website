import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/shared/lib/env';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { whatsappChatRepository } from './whatsapp-chat.repository';

interface WebhookContact {
  profile?: { name?: string };
  wa_id: string;
}

interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
}

interface WebhookStatus {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
}

interface WebhookValue {
  messaging_product?: string;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: WebhookContact[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
}

interface WebhookPayload {
  object?: string;
  entry?: { id: string; changes?: { field: string; value: WebhookValue }[] }[];
}

function messageBody(message: WebhookMessage): string {
  if (message.type === 'text') {
    return message.text?.body?.trim() || '';
  }
  if (message.type === 'image') {
    return message.image?.caption?.trim() || '[Image]';
  }
  if (message.type === 'button') {
    return message.button?.text?.trim() || '[Button]';
  }
  if (message.type === 'interactive') {
    return (
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      '[Interactive]'
    );
  }
  return `[${message.type}]`;
}

async function defaultOrganizationId(): Promise<string> {
  const org = await prisma.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!org) {
    throw new HttpError(503, 'No organization configured for WhatsApp inbox');
  }
  return org.id;
}

export const whatsappWebhookService = {
  verify(mode: string | null, token: string | null, challenge: string | null): string {
    const expected = getServerEnv().META_WEBHOOK_VERIFY_TOKEN;
    if (!expected) {
      throw new HttpError(503, 'META_WEBHOOK_VERIFY_TOKEN is not set');
    }
    if (mode !== 'subscribe' || !token || token !== expected || !challenge) {
      throw new HttpError(403, 'Webhook verification failed');
    }
    return challenge;
  },

  assertSignature(rawBody: string, signatureHeader: string | null): void {
    const secret = getServerEnv().META_APP_SECRET;
    if (!secret) {
      // Allow in local/dev when secret is not set yet; production should set META_APP_SECRET.
      return;
    }
    if (!signatureHeader?.startsWith('sha256=')) {
      throw new HttpError(401, 'Missing Meta signature');
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new HttpError(401, 'Invalid Meta signature');
    }
  },

  async ingest(payload: WebhookPayload): Promise<{ stored: number }> {
    if (payload.object !== 'whatsapp_business_account') {
      return { stored: 0 };
    }
    const phoneNumberId = getServerEnv().WHATSAPP_PHONE_NUMBER_ID;
    const organizationId = await defaultOrganizationId();
    let stored = 0;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') {
          continue;
        }
        const value = change.value;
        if (
          phoneNumberId &&
          value.metadata?.phone_number_id &&
          value.metadata.phone_number_id !== phoneNumberId
        ) {
          continue;
        }

        for (const status of value.statuses ?? []) {
          if (status.id && status.status) {
            await whatsappChatRepository.updateMessageStatus(status.id, status.status);
          }
        }

        const nameByWaId = new Map(
          (value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name ?? null])
        );

        for (const message of value.messages ?? []) {
          const body = messageBody(message);
          if (!body) {
            continue;
          }
          const timestamp = new Date(Number(message.timestamp) * 1000);
          const conversation = await whatsappChatRepository.upsertConversation({
            organizationId,
            waId: message.from,
            contactName: nameByWaId.get(message.from) ?? null,
            preview: body,
            timestamp,
            inbound: true,
          });
          await whatsappChatRepository.createMessage({
            organizationId,
            conversationId: conversation.id,
            wamid: message.id,
            direction: 'inbound',
            type: message.type,
            body,
            status: 'received',
            timestamp,
          });
          stored += 1;
        }
      }
    }

    return { stored };
  },
};
