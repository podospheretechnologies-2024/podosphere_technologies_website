import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import type {
  PodoCrmWhatsAppLinkResult,
  PodoCrmWhatsAppSyncStatus,
} from '../../types/podocrm-whatsapp-sync';
import { podoCrmWhatsAppSyncRepository } from './podocrm-whatsapp-sync.repository';

const DEFAULT_PODOCRM_API_BASE = 'https://podocrm.podospheretechnologies.com/api';
const LINK_TIMEOUT_MS = 15_000;
const SIGNED_TIMEOUT_MS = 8_000;

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

async function signedPost(
  podocrmBaseUrl: string,
  path: string,
  syncSecretPlain: string,
  body: Record<string, unknown>
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
    signal: AbortSignal.timeout(SIGNED_TIMEOUT_MS),
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
