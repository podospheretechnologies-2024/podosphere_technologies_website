import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { decrypt } from '@/shared/lib/crypto';
import { HttpError } from '@/shared/server/http-error';
import { podoCrmWhatsAppSyncRepository } from './podocrm-whatsapp-sync.repository';

const SIGNED_TIMEOUT_MS = 12_000;

export interface PodoCrmLeadPushInput {
  organizationId: string;
  lead: {
    id: string;
    source: string;
    externalId: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    stage: string;
    score: number | null;
    scoreReasons: string[];
    customerId: string | null;
    payload: unknown;
    createdAt: Date;
  };
}

export interface PodoCrmLeadPushResult {
  ok: true;
  crmExternalId: string | null;
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

/**
 * Push a scored Social lead into PodoCRM using the org's existing WhatsApp sync link
 * (same sync_secret / base URL). Endpoint: POST /sync/leads on the CRM API.
 */
export const podoCrmLeadSyncService = {
  async isLinked(organizationId: string): Promise<boolean> {
    const row = await podoCrmWhatsAppSyncRepository.findByOrganization(organizationId);
    return Boolean(row);
  },

  async pushLead(input: PodoCrmLeadPushInput): Promise<PodoCrmLeadPushResult> {
    const row = await podoCrmWhatsAppSyncRepository.findByOrganization(input.organizationId);
    if (!row) {
      throw new HttpError(400, 'Link PodoCRM first (Channels → PodoCRM WhatsApp sync), then push leads.');
    }

    const secret = decrypt(row.syncSecret);
    const workspaceId = input.organizationId.slice(0, 64);
    const lead = input.lead;

    const body: Record<string, unknown> = {
      event_id: randomUUID(),
      workspace_id: workspaceId,
      company_id: row.podocrmCompanyId,
      lead: {
        social_lead_id: lead.id,
        source: lead.source,
        external_id: lead.externalId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        stage: lead.stage,
        score: lead.score,
        score_reasons: lead.scoreReasons,
        customer_id: lead.customerId,
        payload: lead.payload,
        created_at: lead.createdAt.toISOString(),
      },
    };

    let response: Response;
    try {
      response = await signedPost(row.podocrmBaseUrl, '/sync/leads', secret, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach PodoCRM';
      throw new HttpError(502, `PodoCRM lead push failed: ${message}`);
    }

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { lead_id?: string; id?: string; crm_lead_id?: string };
      error?: string;
      message?: string;
    };

    if (!response.ok || payload.success === false) {
      const detail =
        payload.message || payload.error || `Lead push failed (HTTP ${response.status})`;
      console.error(`[podocrm-leads] push failed status=${response.status} detail=${detail}`);
      throw new HttpError(response.status >= 400 && response.status < 500 ? response.status : 502, String(detail));
    }

    const crmExternalId =
      payload.data?.crm_lead_id ?? payload.data?.lead_id ?? payload.data?.id ?? null;

    console.info(
      `[podocrm-leads] push ok status=${response.status} lead=${lead.id} crm=${crmExternalId ?? 'n/a'}`
    );

    return { ok: true, crmExternalId };
  },
};
