import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/shared/lib/env';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { whatsappChatRepository } from './whatsapp-chat.repository';
import { podoCrmWhatsAppSyncService } from '../podocrm/podocrm-whatsapp-sync.service';

const DEFAULT_PODOCRM_WHATSAPP_WEBHOOK_URL =
  'https://podocrm.podospheretechnologies.com/api/whatsapp/webhook';
const PODOCRM_FORWARD_TIMEOUT_MS = 8_000;

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

// Outbound messages are stored under the sender's organization, so route inbound replies to the
// organization already talking to this contact, then to whichever one last used WhatsApp.
async function resolveOrganizationId(waId: string): Promise<string> {
  const conversation =
    (await prisma.whatsAppConversation.findFirst({
      where: { waId },
      orderBy: { lastMessageAt: 'desc' },
      select: { organizationId: true },
    })) ??
    (await prisma.whatsAppConversation.findFirst({
      orderBy: { lastMessageAt: 'desc' },
      select: { organizationId: true },
    }));
  if (conversation) {
    return conversation.organizationId;
  }

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

        for (const message of value.messages ?? []) {
          const body = messageBody(message);
          if (!body) {
            continue;
          }
          const timestamp = new Date(Number(message.timestamp) * 1000);
          const organizationId = await resolveOrganizationId(message.from);
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
            source: 'customer',
            timestamp,
          });
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
          const organizationId = await resolveOrganizationId(recipientWaId);
          const conversation = await whatsappChatRepository.upsertConversation({
            organizationId,
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
