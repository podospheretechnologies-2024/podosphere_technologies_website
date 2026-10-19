import 'server-only';
import { getServerEnv } from '@/shared/lib/env';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { podoCrmWhatsAppSyncService } from '../podocrm/podocrm-whatsapp-sync.service';
import { autoReplyService } from './auto-reply.service';
import { whatsappChatRepository } from './whatsapp-chat.repository';
import { verifyMetaHubSignature } from './meta-webhook-signature';

const DEFAULT_PODOCRM_WHATSAPP_WEBHOOK_URL =
  'https://podocrm.podospheretechnologies.com/api/whatsapp/webhook';
const PODOCRM_FORWARD_TIMEOUT_MS = 8_000;

const OPT_OUT_KEYWORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);

function isBroadcastOptOut(body: string): boolean {
  const token = body.trim().toUpperCase().replace(/[.!]+$/, '');
  return OPT_OUT_KEYWORDS.has(token);
}

interface WebhookContact {
  profile?: { name?: string };
  wa_id: string;
}

interface WebhookMessage {
  from: string;
  to?: string;
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
  message_echoes?: WebhookMessage[];
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

/** Owner of a WhatsApp phone number (Embedded Signup connection), when present. */
async function resolveConnection(phoneNumberId: string | undefined | null): Promise<{
  organizationId: string;
  customerId: string | null;
} | null> {
  if (!phoneNumberId) return null;
  const connection = await prisma.socialWhatsAppConnection.findUnique({
    where: { phoneNumberId },
    select: { organizationId: true, customerId: true },
  });
  return connection;
}

// Prefer the Embedded Signup connection for this phone_number_id; otherwise route by existing
// conversation with this contact, then fall back to the oldest organization.
async function resolveOwner(
  waId: string,
  phoneNumberId: string | undefined | null
): Promise<{ organizationId: string; customerId: string | null }> {
  const connection = await resolveConnection(phoneNumberId);
  if (connection) {
    return connection;
  }

  const conversation =
    (await prisma.whatsAppConversation.findFirst({
      where: { waId },
      orderBy: { lastMessageAt: 'desc' },
      select: { organizationId: true, customerId: true },
    })) ??
    (await prisma.whatsAppConversation.findFirst({
      orderBy: { lastMessageAt: 'desc' },
      select: { organizationId: true, customerId: true },
    }));
  if (conversation) {
    return { organizationId: conversation.organizationId, customerId: conversation.customerId };
  }

  const org = await prisma.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!org) {
    throw new HttpError(503, 'No organization configured for WhatsApp inbox');
  }
  return { organizationId: org.id, customerId: null };
}

/** Resolve PodoCRM forward target, or null when forwarding is disabled. */
function podoCrmForwardTarget(): string | null {
  const env = getServerEnv();
  if (env.PODOCRM_WHATSAPP_FORWARD === 'false') {
    return null;
  }

  const url = env.PODOCRM_WHATSAPP_WEBHOOK_URL ?? DEFAULT_PODOCRM_WHATSAPP_WEBHOOK_URL;

  if (env.PODOCRM_WHATSAPP_FORWARD === 'true') {
    return url;
  }

  // Default: forward in production; in other envs only when URL is explicitly set.
  if (env.NODE_ENV === 'production') {
    return url;
  }
  if (env.PODOCRM_WHATSAPP_WEBHOOK_URL) {
    return url;
  }
  return null;
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
    verifyMetaHubSignature(rawBody, signatureHeader, secret);
  },

  /**
   * Route B: forward the exact Meta webhook body + signature to PodoCRM.
   * Fire-and-forget safe — never throws to the caller.
   */
  async forwardToPodoCrm(rawBody: string, signatureHeader: string | null): Promise<void> {
    const url = podoCrmForwardTarget();
    if (!url) {
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (signatureHeader) {
        headers['X-Hub-Signature-256'] = signatureHeader;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: rawBody,
        signal: AbortSignal.timeout(PODOCRM_FORWARD_TIMEOUT_MS),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(
          `[whatsapp] forwarded webhook to PodoCRM status=${response.status}${detail ? ` body=${detail.slice(0, 200)}` : ''}`
        );
        return;
      }

      console.info(`[whatsapp] forwarded webhook to PodoCRM status=${response.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`[whatsapp] forwarded webhook to PodoCRM error=${message}`);
    }
  },

  async ingest(payload: WebhookPayload): Promise<{ stored: number }> {
    if (payload.object !== 'whatsapp_business_account') {
      return { stored: 0 };
    }
    const phoneNumberId = getServerEnv().WHATSAPP_PHONE_NUMBER_ID;
    let stored = 0;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        // With several apps on the WABA, apps that don't own the thread get inbound copies as 'standby'.
        // message_echoes = outbound copies when another app (e.g. PodoCRM) sent on the same number.
        if (
          change.field !== 'messages' &&
          change.field !== 'standby' &&
          change.field !== 'message_echoes'
        ) {
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
            void podoCrmWhatsAppSyncService.relayStatus({
              phoneNumberId: value.metadata?.phone_number_id ?? null,
              wamid: status.id,
              status: status.status,
              recipientId: status.recipient_id ?? null,
              timestamp: status.timestamp ?? null,
            });
          }
        }

        const nameByWaId = new Map(
          (value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name ?? null])
        );

        const webhookPhoneNumberId = value.metadata?.phone_number_id ?? null;

        for (const message of value.messages ?? []) {
          const body = messageBody(message);
          if (!body) {
            continue;
          }
          const timestamp = new Date(Number(message.timestamp) * 1000);
          const { organizationId, customerId } = await resolveOwner(
            message.from,
            webhookPhoneNumberId
          );

          // Skip auto-reply on Meta webhook retries (same wamid already stored).
          const alreadyStored = message.id
            ? await prisma.whatsAppMessage.findUnique({
                where: { wamid: message.id },
                select: { id: true },
              })
            : null;

          // F15: match + send before saving the inbound message.
          if (!alreadyStored) {
            await autoReplyService.maybeReply({
              organizationId,
              customerId,
              waId: message.from,
              body,
              skip: isBroadcastOptOut(body),
            });
          }

          const conversation = await whatsappChatRepository.upsertConversation({
            organizationId,
            customerId,
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
            source: 'customer',
            timestamp,
          });
          if (isBroadcastOptOut(body)) {
            await prisma.whatsAppConversation.update({
              where: { id: conversation.id },
              data: { optedOutAt: timestamp },
            });
          }
          stored += 1;
        }

        // Outbound echoes from other apps (CRM) on the same WhatsApp number.
        for (const echo of value.message_echoes ?? []) {
          const body = messageBody(echo);
          const recipientWaId = echo.to?.replace(/\D/g, '') || null;
          if (!body || !recipientWaId) {
            continue;
          }
          const timestamp = new Date(Number(echo.timestamp) * 1000);
          const { organizationId, customerId } = await resolveOwner(
            recipientWaId,
            webhookPhoneNumberId
          );
          const conversation = await whatsappChatRepository.upsertConversation({
            organizationId,
            customerId,
            waId: recipientWaId,
            contactName: nameByWaId.get(recipientWaId) ?? null,
            preview: body,
            timestamp,
            inbound: false,
          });
          // If Social already stored this wamid, keep podosocial; otherwise label as CRM/external.
          await whatsappChatRepository.createMessage({
            organizationId,
            conversationId: conversation.id,
            wamid: echo.id,
            direction: 'outbound',
            type: echo.type,
            body,
            status: 'sent',
            source: 'podocrm',
            senderLabel: 'PodoCRM',
            timestamp,
          });
          stored += 1;
        }
      }
    }

    return { stored };
  },
};
