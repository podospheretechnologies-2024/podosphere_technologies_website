import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import type {
  PodoCrmWhatsAppHistorySyncResult,
  PodoCrmWhatsAppLinkResult,
  PodoCrmWhatsAppSyncStatus,
} from '../../types/podocrm-whatsapp-sync';
import { whatsappChatRepository } from '../whatsapp/whatsapp-chat.repository';
import { podoCrmWhatsAppSyncRepository } from './podocrm-whatsapp-sync.repository';

const DEFAULT_PODOCRM_API_BASE = 'https://podocrm.podospheretechnologies.com/api';
const LINK_TIMEOUT_MS = 15_000;
const SIGNED_TIMEOUT_MS = 8_000;
const HISTORY_TIMEOUT_MS = 30_000;
const HISTORY_BATCH_LIMIT = 400;

interface LinkApiData {
  sync_secret?: string;
  syncSecret?: string;
  phone_number_id?: string;
  phoneNumberId?: string;
  podocrm_company_id?: string;
  podocrmCompanyId?: string;
  company_id?: string;
  companyId?: string;
  podocrm_base_url?: string;
  podocrmBaseUrl?: string;
}

interface LinkApiResponse {
  success?: boolean;
  data?: LinkApiData;
  error?: string;
  code?: string;
  message?: string;
}

const DEFAULT_PARTNER_BASE_URL = 'https://social.podospheretechnologies.com/api';

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function redactLinkLog(payload: unknown): string {
  try {
    const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    const data = clone.data;
    if (data && typeof data === 'object' && data !== null) {
      const nested = data as Record<string, unknown>;
      for (const key of ['sync_secret', 'syncSecret', 'sync_token', 'syncToken', 'secret']) {
        if (typeof nested[key] === 'string') {
          const value = nested[key] as string;
          nested[key] = value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)}` : '[redacted]';
        }
      }
    }
    for (const key of ['sync_secret', 'syncSecret', 'sync_token', 'syncToken', 'secret']) {
      if (typeof clone[key] === 'string') {
        const value = clone[key] as string;
        clone[key] = value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)}` : '[redacted]';
      }
    }
    return JSON.stringify(clone);
  } catch {
    return '[unserializable link response]';
  }
}

function apiBase(): string {
  const env = getServerEnv();
  return (env.PODOCRM_API_BASE_URL ?? DEFAULT_PODOCRM_API_BASE).replace(/\/$/, '');
}

function partnerBaseUrl(): string {
  // Prefer production Social API URL so CRM always gets a stable partner callback base.
  const appUrl = getServerEnv().APP_URL.replace(/\/$/, '');
  if (appUrl.includes('social.podospheretechnologies.com')) {
    return `${appUrl}/api`;
  }
  return DEFAULT_PARTNER_BASE_URL;
}

function toStatus(
  row: Awaited<ReturnType<typeof podoCrmWhatsAppSyncRepository.findByOrganization>>
): PodoCrmWhatsAppSyncStatus {
  if (!row) {
    return {
      linked: false,
      phoneNumberId: null,
      podocrmCompanyId: null,
      podocrmBaseUrl: null,
      linkedAt: null,
      lastPingAt: null,
    };
  }
  return {
    linked: true,
    phoneNumberId: row.phoneNumberId,
    podocrmCompanyId: row.podocrmCompanyId,
    podocrmBaseUrl: row.podocrmBaseUrl,
    linkedAt: row.linkedAt.toISOString(),
    lastPingAt: row.lastPingAt?.toISOString() ?? null,
  };
}

function buildSignature(syncSecret: string, rawBody: string): string {
  const t = Math.floor(Date.now() / 1000).toString();
  const v1 = createHmac('sha256', syncSecret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

function parseSignatureHeader(header: string | null): { t: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    })
  );
  if (!parts.t || !parts.v1) return null;
  return { t: parts.t, v1: parts.v1 };
}

function assertValidSignature(syncSecret: string, rawBody: string, header: string | null): void {
  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    throw new HttpError(401, 'Missing X-Podo-Signature');
  }
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parsed.t));
  if (!Number.isFinite(age) || age > 300) {
    throw new HttpError(401, 'Stale X-Podo-Signature');
  }
  const expected = createHmac('sha256', syncSecret).update(`${parsed.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(parsed.v1, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, 'Invalid X-Podo-Signature');
  }
}

async function signedPost(
  podocrmBaseUrl: string,
  path: string,
  syncSecretPlain: string,
  body: Record<string, unknown>,
  timeoutMs = SIGNED_TIMEOUT_MS
): Promise<Response> {
  const base = podocrmBaseUrl.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const rawBody = JSON.stringify(body);
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Podo-Signature': buildSignature(syncSecretPlain, rawBody),
    },
    body: rawBody,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export const podoCrmWhatsAppSyncService = {
  async getStatus(organizationId: string): Promise<PodoCrmWhatsAppSyncStatus> {
    const row = await podoCrmWhatsAppSyncRepository.findByOrganization(organizationId);
    return toStatus(row);
  },

  async link(organizationId: string, code: string): Promise<PodoCrmWhatsAppLinkResult> {
    const trimmed = code.trim().toUpperCase();
    if (!/^PSL-[A-Z0-9]+-[A-Z0-9]+$/.test(trimmed)) {
      throw new HttpError(400, 'Invalid link code. Paste a code like PSL-9R76E-PPAD2 from PodoCRM.');
    }

    const workspaceId = organizationId.slice(0, 64);
    const requestBody = {
      code: trimmed,
      workspace_id: workspaceId,
      partner_base_url: partnerBaseUrl(),
    };

    let response: Response;
    try {
      response = await fetch(`${apiBase()}/sync/whatsapp/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach PodoCRM';
      throw new HttpError(502, `PodoCRM link failed: ${message}`);
    }

    const payload = (await response.json().catch(() => ({}))) as LinkApiResponse;
    console.info(`[podocrm-sync] link response status=${response.status} body=${redactLinkLog(payload)}`);

    if (!response.ok || payload.success === false) {
      const detail =
        payload.message ||
        payload.error ||
        payload.code ||
        (response.status === 404
          ? 'LINK_CODE_INVALID — generate a new code in PodoCRM'
          : `Link failed (HTTP ${response.status})`);
      throw new HttpError(
        response.status === 404 || payload.code === 'LINK_CODE_INVALID' ? 404 : 502,
        String(detail)
      );
    }

    // PodoCRM success shape: { success: true, data: { sync_secret, phone_number_id, ... } }
    const data = payload.data;
    if (!data || typeof data !== 'object') {
      throw new HttpError(502, 'PodoCRM link response was missing data object');
    }

    const syncSecret = pickString(data.sync_secret, data.syncSecret);
    const phoneNumberId = pickString(data.phone_number_id, data.phoneNumberId);
    const companyId = pickString(
      data.podocrm_company_id,
      data.podocrmCompanyId,
      data.company_id,
      data.companyId
    );
    const baseUrl = (
      pickString(data.podocrm_base_url, data.podocrmBaseUrl) || apiBase()
    ).replace(/\/$/, '');

    if (!syncSecret || !phoneNumberId || !companyId) {
      throw new HttpError(
        502,
        `PodoCRM link data missing required fields (got keys: ${Object.keys(data).join(', ') || 'none'})`
      );
    }

    await podoCrmWhatsAppSyncRepository.upsert({
      organizationId,
      syncSecret: encrypt(syncSecret),
      phoneNumberId,
      podocrmCompanyId: companyId,
      podocrmBaseUrl: baseUrl,
    });

    // Activate sync with a signed ping (do not fail the link if ping is temporarily down).
    try {
      const ping = await signedPost(baseUrl, '/sync/whatsapp/ping', syncSecret, {
        event_id: randomUUID(),
        phone_number_id: phoneNumberId,
        workspace_id: workspaceId,
      });
      if (ping.ok) {
        await podoCrmWhatsAppSyncRepository.markPinged(organizationId);
        console.info(`[podocrm-sync] ping ok status=${ping.status}`);
      } else {
        console.error(`[podocrm-sync] ping failed status=${ping.status}`);
      }
    } catch (error) {
      console.error(
        `[podocrm-sync] ping error=${error instanceof Error ? error.message : 'unknown'}`
      );
    }

    const status = await this.getStatus(organizationId);
    return {
      ...status,
      // One-time hint only — do not log this value.
      syncSecretPreview: `${syncSecret.slice(0, 4)}…${syncSecret.slice(-4)}`,
    };
  },

  async unlink(organizationId: string): Promise<void> {
    await podoCrmWhatsAppSyncRepository.delete(organizationId);
  },

  /**
   * Partner callback: PodoCRM posts outbound sends here so they appear in Social inbox.
   * Path matches partner_base_url + /sync/whatsapp/echo.
   */
  async ingestPartnerEcho(
    rawBody: string,
    signatureHeader: string | null
  ): Promise<{ stored: boolean }> {
    let body: {
      phone_number_id?: string;
      wamid?: string;
      to?: string;
      type?: string;
      text?: string;
      template?: { name?: string; language?: string | null };
      sent_at?: string;
      sender?: string | null;
    };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }

    const phoneNumberId = pickString(body.phone_number_id);
    const wamid = pickString(body.wamid);
    const to = pickString(body.to)?.replace(/\D/g, '');
    if (!phoneNumberId || !wamid || !to) {
      throw new HttpError(400, 'phone_number_id, wamid, and to are required');
    }

    const links = await podoCrmWhatsAppSyncRepository.findByPhoneNumberId(phoneNumberId);
    if (links.length === 0) {
      throw new HttpError(404, 'No linked PodoCRM sync for this phone_number_id');
    }

    let matched = false;
    for (const row of links) {
      try {
        assertValidSignature(decrypt(row.syncSecret), rawBody, signatureHeader);
        matched = true;

        const text =
          body.type === 'template'
            ? `Template: ${body.template?.name ?? 'unknown'}`
            : (body.text ?? '').trim();
        if (!text) {
          throw new HttpError(400, 'Message text is empty');
        }

        const timestamp = body.sent_at ? new Date(body.sent_at) : new Date();
        const conversation = await whatsappChatRepository.upsertConversation({
          organizationId: row.organizationId,
          waId: to,
          preview: text,
          timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
          inbound: false,
        });
        await whatsappChatRepository.createMessage({
          organizationId: row.organizationId,
          conversationId: conversation.id,
          wamid,
          direction: 'outbound',
          type: body.type === 'template' ? 'template' : 'text',
          body: text,
          status: 'sent',
          source: 'podocrm',
          senderLabel: pickString(body.sender) || 'PodoCRM',
          timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
        });
        return { stored: true };
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          continue;
        }
        throw error;
      }
    }

    if (!matched) {
      throw new HttpError(401, 'Invalid X-Podo-Signature');
    }
    return { stored: false };
  },

  /**
   * Push existing Social WhatsApp messages into PodoCRM so old chats appear there.
   * Prefers batch `/sync/whatsapp/history`; falls back to per-message echo for outbound.
   */
  async syncHistory(organizationId: string): Promise<PodoCrmWhatsAppHistorySyncResult> {
    const row = await podoCrmWhatsAppSyncRepository.findByOrganization(organizationId);
    if (!row) {
      throw new HttpError(400, 'Link PodoCRM first, then sync chat history.');
    }

    const messages = await whatsappChatRepository.listRecentWithConversation(
      organizationId,
      HISTORY_BATCH_LIMIT
    );
    if (messages.length === 0) {
      return { attempted: 0, synced: 0, mode: 'batch', skipped: 0 };
    }

    const secret = decrypt(row.syncSecret);
    const workspaceId = organizationId.slice(0, 64);
    const payloadMessages = messages.map((message) => {
      const waId = message.conversation.waId;
      const isInbound = message.direction === 'inbound';
      const isTemplate = message.type === 'template' || message.body.startsWith('Template:');
      const entry: Record<string, unknown> = {
        wamid: message.wamid ?? `social-${message.id}`,
        direction: isInbound ? 'inbound' : 'outbound',
        type: isTemplate ? 'template' : 'text',
        text: message.body,
        sent_at: message.timestamp.toISOString(),
        contact_name: message.conversation.contactName ?? null,
        status: message.status ?? null,
      };
      if (isInbound) {
        entry.from = waId;
        entry.to = row.phoneNumberId;
        entry.sender = null;
      } else {
        entry.to = waId;
        entry.from = row.phoneNumberId;
        entry.sender = 'PodoSocial';
        if (isTemplate) {
          const match = /^Template:\s*([^\s(]+)/i.exec(message.body);
          entry.template = {
            name: match?.[1] ?? 'unknown',
            language: null,
          };
        }
      }
      return entry;
    });

    try {
      const response = await signedPost(
        row.podocrmBaseUrl,
        '/sync/whatsapp/history',
        secret,
        {
          event_id: randomUUID(),
          phone_number_id: row.phoneNumberId,
          workspace_id: workspaceId,
          messages: payloadMessages,
        },
        HISTORY_TIMEOUT_MS
      );
      if (response.ok) {
        console.info(
          `[podocrm-sync] history batch ok status=${response.status} count=${payloadMessages.length}`
        );
        return {
          attempted: payloadMessages.length,
          synced: payloadMessages.length,
          mode: 'batch',
          skipped: 0,
        };
      }
      console.error(
        `[podocrm-sync] history batch failed status=${response.status}; falling back to echo`
      );
    } catch (error) {
      console.error(
        `[podocrm-sync] history batch error=${error instanceof Error ? error.message : 'unknown'}; falling back to echo`
      );
    }

    // Fallback: replay outbound via echo (inbound already arrives via webhook forward going forward).
    let synced = 0;
    let skipped = 0;
    for (const message of messages) {
      if (message.direction !== 'outbound' || !message.wamid) {
        skipped += 1;
        continue;
      }
      const isTemplate = message.type === 'template' || message.body.startsWith('Template:');
      try {
        const body: Record<string, unknown> = {
          event_id: randomUUID(),
          phone_number_id: row.phoneNumberId,
          wamid: message.wamid,
          to: message.conversation.waId,
          type: isTemplate ? 'template' : 'text',
          sent_at: message.timestamp.toISOString(),
          sender: 'PodoSocial',
        };
        if (isTemplate) {
          const match = /^Template:\s*([^\s(]+)/i.exec(message.body);
          body.template = { name: match?.[1] ?? 'unknown', language: null };
        } else {
          body.text = message.body;
        }
        const response = await signedPost(row.podocrmBaseUrl, '/sync/whatsapp/echo', secret, body);
        if (response.ok) {
          synced += 1;
        } else {
          skipped += 1;
          console.error(`[podocrm-sync] history echo failed status=${response.status}`);
        }
      } catch (error) {
        skipped += 1;
        console.error(
          `[podocrm-sync] history echo error=${error instanceof Error ? error.message : 'unknown'}`
        );
      }
    }

    return {
      attempted: messages.length,
      synced,
      mode: 'echo-fallback',
      skipped,
    };
  },

  /** Fire-and-forget echo of outbound Social replies into PodoCRM. */
  async echoOutbound(
    organizationId: string,
    input: {
      wamid: string;
      to: string;
      type: 'text' | 'template';
      text?: string;
      templateName?: string;
      language?: string;
      sender?: string | null;
    }
  ): Promise<void> {
    const row = await podoCrmWhatsAppSyncRepository.findByOrganization(organizationId);
    if (!row) return;

    try {
      const secret = decrypt(row.syncSecret);
      const body: Record<string, unknown> = {
        event_id: randomUUID(),
        phone_number_id: row.phoneNumberId,
        wamid: input.wamid,
        to: input.to,
        type: input.type,
        sent_at: new Date().toISOString(),
        sender: input.sender ?? null,
      };
      if (input.type === 'text') {
        body.text = input.text ?? '';
      } else {
        body.template = {
          name: input.templateName,
          language: input.language,
        };
      }

      const response = await signedPost(row.podocrmBaseUrl, '/sync/whatsapp/echo', secret, body);
      if (!response.ok) {
        console.error(`[podocrm-sync] echo failed status=${response.status}`);
      }
    } catch (error) {
      console.error(
        `[podocrm-sync] echo error=${error instanceof Error ? error.message : 'unknown'}`
      );
    }
  },

  /** Fire-and-forget delivery status relay to PodoCRM. */
  async relayStatus(input: {
    phoneNumberId?: string | null;
    wamid: string;
    status: string;
    recipientId?: string | null;
    timestamp?: string | null;
  }): Promise<void> {
    const links = input.phoneNumberId
      ? await podoCrmWhatsAppSyncRepository.findByPhoneNumberId(input.phoneNumberId)
      : [];
    if (links.length === 0) {
      // Fall back: any linked org (single-tenant deploys).
      const envPhone = getServerEnv().WHATSAPP_PHONE_NUMBER_ID;
      if (!envPhone) return;
      const fallback = await podoCrmWhatsAppSyncRepository.findByPhoneNumberId(envPhone);
      if (fallback.length === 0) return;
      links.push(...fallback);
    }

    for (const row of links) {
      try {
        const secret = decrypt(row.syncSecret);
        const response = await signedPost(row.podocrmBaseUrl, '/sync/whatsapp/status', secret, {
          event_id: randomUUID(),
          phone_number_id: row.phoneNumberId,
          wamid: input.wamid,
          status: input.status,
          recipient_id: input.recipientId ?? null,
          timestamp: input.timestamp ?? null,
        });
        if (!response.ok) {
          console.error(`[podocrm-sync] status failed status=${response.status}`);
        }
      } catch (error) {
        console.error(
          `[podocrm-sync] status error=${error instanceof Error ? error.message : 'unknown'}`
        );
      }
    }
  },
};
