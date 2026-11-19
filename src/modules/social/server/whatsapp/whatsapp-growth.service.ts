import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { whatsappBroadcastRatePaise } from '../../config/billing';
import {
  parsePortalTabsConfig,
  portalWhatsAppDailyCap,
} from '../../config/portal-tabs';
import { planService } from '../billing/plan.service';
import { whatsappService } from '../whatsapp/whatsapp.service';

/** Single selected client → that id; 'all' → null (agency-shared connection). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

/**
 * Attach this app to a WABA so Meta delivers messages/statuses to /api/webhooks/whatsapp.
 * App-level /{app-id}/subscriptions alone is not enough for Embedded Signup numbers.
 */
async function subscribeWabaApps(wabaId: string, accessToken: string): Promise<void> {
  const env = getServerEnv();
  const response = await fetch(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${wabaId}/subscribed_apps`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new HttpError(
      502,
      detail.error?.message || 'Could not subscribe this WhatsApp account to Podo Social webhooks'
    );
  }
}

/** Best-effort detach on disconnect — never blocks deleting the local connection. */
async function unsubscribeWabaApps(wabaId: string, accessToken: string): Promise<void> {
  const env = getServerEnv();
  try {
    const response = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${wabaId}/subscribed_apps`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!response.ok) {
      const detail = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      console.warn(
        `[whatsapp] unsubscribe subscribed_apps failed for waba=${wabaId}: ${
          detail.error?.message ?? `HTTP ${response.status}`
        }`
      );
    }
  } catch (error) {
    console.warn(
      `[whatsapp] unsubscribe subscribed_apps failed for waba=${wabaId}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
}

export const whatsappOnboardingService = {
  config() {
    const env = getServerEnv();
    return {
      configured: Boolean(env.META_APP_ID && env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID && env.META_APP_SECRET),
      appId: env.META_APP_ID ?? null,
      configId: env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID ?? null,
      graphVersion: env.META_GRAPH_VERSION,
    };
  },

  async connection(scope: ClientScope) {
    const row = await prisma.socialWhatsAppConnection.findFirst({ where: scopeWhere(scope) });
    if (!row) return null;
    return {
      id: row.id,
      wabaId: row.wabaId,
      phoneNumberId: row.phoneNumberId,
      displayPhone: row.displayPhone,
      businessName: row.businessName,
      customerId: row.customerId,
      connectedAt: row.createdAt.toISOString(),
    };
  },

  /** All numbers for this org (Phase 6.3) — assign each to a client or leave agency-shared. */
  async listConnections(organizationId: string) {
    const rows = await prisma.socialWhatsAppConnection.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        wabaId: true,
        phoneNumberId: true,
        displayPhone: true,
        businessName: true,
        customerId: true,
        createdAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      wabaId: row.wabaId,
      phoneNumberId: row.phoneNumberId,
      displayPhone: row.displayPhone,
      businessName: row.businessName,
      customerId: row.customerId,
      connectedAt: row.createdAt.toISOString(),
    }));
  },

  async assignConnection(
    organizationId: string,
    connectionId: string,
    customerId: string | null
  ) {
    if (customerId) {
      const client = await prisma.socialCustomer.findFirst({
        where: { id: customerId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!client) throw new HttpError(404, 'Client not found');
    }
    const updated = await prisma.socialWhatsAppConnection.updateMany({
      where: { id: connectionId, organizationId },
      data: { customerId },
    });
    if (updated.count === 0) throw new HttpError(404, 'WhatsApp connection not found');
    return this.listConnections(organizationId);
  },

  async completeSignup(
    scope: ClientScope,
    input: { code: string; wabaId: string; phoneNumberId: string; displayPhone?: string; businessName?: string }
  ) {
    const env = getServerEnv();
    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      throw new HttpError(503, 'Set META_APP_ID and META_APP_SECRET for Embedded Signup');
    }
    const body = new URLSearchParams({
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      code: input.code,
    });
    const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!response.ok || !payload.access_token) {
      throw new HttpError(502, payload.error?.message || 'Could not exchange the Embedded Signup code');
    }
    const customerId = customerIdForWrite(scope);
    await prisma.socialWhatsAppConnection.upsert({
      where: { phoneNumberId: input.phoneNumberId },
      create: {
        organizationId: scope.organizationId,
        customerId,
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        displayPhone: input.displayPhone ?? null,
        businessName: input.businessName ?? null,
        accessToken: encrypt(payload.access_token),
      },
      update: {
        organizationId: scope.organizationId,
        customerId,
        wabaId: input.wabaId,
        displayPhone: input.displayPhone ?? null,
        businessName: input.businessName ?? null,
        accessToken: encrypt(payload.access_token),
      },
    });
    // Without this, Meta never delivers this WABA's messages/statuses to our webhook.
    await subscribeWabaApps(input.wabaId, payload.access_token);
    return this.connection(scope);
  },

  /**
   * Disconnect one Embedded Signup number: unsubscribe the WABA, then delete the local row.
   * Unsubscribe failures are logged and ignored so the workspace can still clear the token.
   */
  async disconnect(scope: ClientScope, connectionId?: string) {
    const connection = connectionId
      ? await prisma.socialWhatsAppConnection.findFirst({
          where: { id: connectionId, organizationId: scope.organizationId },
        })
      : await prisma.socialWhatsAppConnection.findFirst({ where: scopeWhere(scope) });
    if (!connection) {
      throw new HttpError(404, 'WhatsApp connection not found');
    }

    let token: string | null = null;
    try {
      token = decrypt(connection.accessToken);
    } catch {
      console.warn(
        `[whatsapp] could not decrypt token before disconnect for connection=${connection.id}`
      );
    }
    if (token) {
      await unsubscribeWabaApps(connection.wabaId, token);
    }

    await prisma.socialWhatsAppConnection.delete({ where: { id: connection.id } });
    return { success: true as const, id: connection.id };
  },

  async createTemplate(
    scope: ClientScope,
    input: { name: string; language: string; category: string; body: string }
  ) {
    const env = getServerEnv();
    const connection = await prisma.socialWhatsAppConnection.findFirst({ where: scopeWhere(scope) });
    const wabaId = connection?.wabaId ?? env.WHATSAPP_WABA_ID;
    const token = connection ? decrypt(connection.accessToken) : env.WHATSAPP_ACCESS_TOKEN;
    if (!wabaId || !token) {
      throw new HttpError(400, 'Connect a WhatsApp number or set WHATSAPP_WABA_ID before creating templates');
    }
    const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        language: input.language,
        category: input.category,
        components: [{ type: 'BODY', text: input.body }],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new HttpError(502, payload.error?.message || 'Meta rejected the template');
    }
    return { id: payload.id ?? null, status: payload.status ?? 'PENDING' };
  },

  async listTemplates(scope: ClientScope) {
    const env = getServerEnv();
    const connection = await prisma.socialWhatsAppConnection.findFirst({ where: scopeWhere(scope) });
    const wabaId = connection?.wabaId ?? env.WHATSAPP_WABA_ID;
    const token = connection ? decrypt(connection.accessToken) : env.WHATSAPP_ACCESS_TOKEN;
    if (!wabaId || !token) throw new HttpError(400, 'WhatsApp not configured');

    const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${wabaId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new HttpError(502, 'Could not fetch templates from Meta');
    return await response.json();
  },

  async deleteTemplate(scope: ClientScope, name: string) {
    const env = getServerEnv();
    const connection = await prisma.socialWhatsAppConnection.findFirst({ where: scopeWhere(scope) });
    const wabaId = connection?.wabaId ?? env.WHATSAPP_WABA_ID;
    const token = connection ? decrypt(connection.accessToken) : env.WHATSAPP_ACCESS_TOKEN;
    if (!wabaId || !token) throw new HttpError(400, 'WhatsApp not configured');

    const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${wabaId}/message_templates?name=${name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new HttpError(502, 'Could not delete template from Meta');
    return await response.json();
  },

  /**
   * Subscribe only the WhatsApp Business Account object to our WhatsApp webhook.
   * Merges existing WABA fields so we never drop template/account updates.
   * Never touches the `page` object (Meta/Instagram inbox webhooks).
   * Callback is always `${APP_URL}/api/webhooks/whatsapp` — never a client-supplied URL.
   */
  async configureWebhooks(_scope: ClientScope) {
    const env = getServerEnv();
    if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_WEBHOOK_VERIFY_TOKEN) {
      throw new HttpError(400, 'App ID, Secret, and Verify Token are required in .env');
    }

    const webhookUrl = `${env.APP_URL.replace(/\/$/, '')}/api/webhooks/whatsapp`;
    if (!webhookUrl.startsWith('https://') && process.env.NODE_ENV === 'production') {
      throw new HttpError(400, 'APP_URL must be HTTPS in production for Meta webhooks');
    }

    const appTokenRes = await fetch(
      `https://graph.facebook.com/oauth/access_token?client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&grant_type=client_credentials`
    );
    const { access_token: appToken } = (await appTokenRes.json()) as { access_token?: string };
    if (!appToken) throw new HttpError(502, 'Could not generate App Token');

    const requiredFields = [
      'messages',
      'message_template_status_update',
      'account_update',
      'phone_number_name_update',
      'phone_number_quality_update',
    ];

    // Read current WABA subscription fields and merge — POST replaces the whole field list.
    const listRes = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_APP_ID}/subscriptions`,
      { headers: { Authorization: `Bearer ${appToken}` } }
    );
    const listPayload = (await listRes.json().catch(() => ({}))) as {
      data?: { object?: string; fields?: { name?: string }[] }[];
    };
    const existing =
      listPayload.data
        ?.find((row) => row.object === 'whatsapp_business_account')
        ?.fields?.map((field) => field.name)
        .filter((name): name is string => Boolean(name)) ?? [];
    const fields = [...new Set([...existing, ...requiredFields])].join(',');

    const response = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_APP_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          object: 'whatsapp_business_account',
          callback_url: webhookUrl,
          verify_token: env.META_WEBHOOK_VERIFY_TOKEN,
          fields,
        }),
      }
    );
    if (!response.ok) {
      const detail = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new HttpError(502, detail.error?.message || 'Could not subscribe WhatsApp webhook on Meta');
    }

    // Repair Embedded Signup connections made before per-WABA subscribed_apps existed.
    const connection = await prisma.socialWhatsAppConnection.findFirst({
      where: scopeWhere(_scope),
    });
    let wabaSubscribed: string | null = null;
    if (connection) {
      await subscribeWabaApps(connection.wabaId, decrypt(connection.accessToken));
      wabaSubscribed = connection.wabaId;
    }

    return {
      success: true,
      callbackUrl: webhookUrl,
      fields: fields.split(','),
      wabaSubscribed,
    };
  },

  async getAccountHealth(scope: ClientScope) {
    const env = getServerEnv();
    const connection = await prisma.socialWhatsAppConnection.findFirst({ where: scopeWhere(scope) });
    const wabaId = connection?.wabaId ?? env.WHATSAPP_WABA_ID;
    const token = connection ? decrypt(connection.accessToken) : env.WHATSAPP_ACCESS_TOKEN;
    if (!wabaId || !token) return { status: 'NOT_CONFIGURED' };

    const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${wabaId}?fields=business_verification_status,message_template_namespace`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return { status: 'ERROR', details: 'Could not fetch health data' };
    const data = await response.json();
    
    return {
      status: 'CONFIGURED',
      verificationStatus: data.business_verification_status || 'UNKNOWN',
      namespace: data.message_template_namespace
    };
  },

  /**
   * Messages sent and delivered per day for the connected number, straight from Meta
   * (so it also counts sends made outside this dashboard). Read counts are not part of
   * this report; Meta only exposes them per template after a one-way opt-in.
   */
  async messageStats(scope: ClientScope, days = 30) {
    const env = getServerEnv();
    const connection = await prisma.socialWhatsAppConnection.findFirst({ where: scopeWhere(scope) });
    if (!connection) return { status: 'NOT_CONFIGURED' as const };

    const end = Math.floor(Date.now() / 1000);
    const start = end - days * 86_400;
    const phone = connection.displayPhone?.replace(/\D/g, '');
    const filters =
      `analytics.start(${start}).end(${end}).granularity(DAY)` + (phone ? `.phone_numbers(["${phone}"])` : '');
    const response = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${connection.wabaId}?fields=${encodeURIComponent(filters)}`,
      { headers: { Authorization: `Bearer ${decrypt(connection.accessToken)}` } }
    );
    const payload = (await response.json().catch(() => ({}))) as {
      analytics?: { data_points?: { start: number; sent?: number; delivered?: number }[] };
      error?: { message?: string };
    };
    if (!response.ok) {
      return { status: 'ERROR' as const, details: payload.error?.message ?? 'Could not fetch message stats' };
    }
    const points = payload.analytics?.data_points ?? [];
    return {
      status: 'OK' as const,
      days,
      sent: points.reduce((sum, point) => sum + (point.sent ?? 0), 0),
      delivered: points.reduce((sum, point) => sum + (point.delivered ?? 0), 0),
    };
  }
};

function normalizePhones(phones: string[]) {
  return [...new Set(phones.map((phone) => phone.replace(/\D/g, '')).filter(Boolean))];
}

async function filterSendablePhones(organizationId: string, phones: string[]) {
  if (phones.length === 0) {
    return { sendable: [] as string[], optedOut: [] as string[] };
  }
  const optedOutRows = await prisma.whatsAppConversation.findMany({
    where: {
      organizationId,
      waId: { in: phones },
      optedOutAt: { not: null },
    },
    select: { waId: true },
  });
  const optedOut = new Set(optedOutRows.map((row) => row.waId));
  return {
    sendable: phones.filter((phone) => !optedOut.has(phone)),
    optedOut: phones.filter((phone) => optedOut.has(phone)),
  };
}

function mapBroadcastRow(row: {
  id: string;
  name: string;
  templateName: string;
  language: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  customerId: string | null;
  consentAt: Date | null;
  estimatedCostPaise: number | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    templateName: row.templateName,
    language: row.language,
    status: row.status,
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    customerId: row.customerId,
    consentAt: row.consentAt?.toISOString() ?? null,
    estimatedCostPaise: row.estimatedCostPaise,
    createdAt: row.createdAt.toISOString(),
  };
}

function variablesFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

async function deliverBroadcast(
  scope: ClientScope,
  broadcast: {
    id: string;
    templateName: string;
    language: string;
    recipients: { id: string; phone: string; status: string }[];
  },
  variables: string[]
) {
  const sendable = broadcast.recipients.filter((row) => row.status !== 'skipped_opted_out');
  await prisma.whatsAppBroadcast.update({
    where: { id: broadcast.id },
    data: { status: 'sending' },
  });

  let sent = 0;
  for (const recipient of broadcast.recipients) {
    if (recipient.status === 'skipped_opted_out') continue;
    try {
      const result = await whatsappService.send(scope, {
        type: 'template',
        to: recipient.phone,
        templateName: broadcast.templateName,
        language: broadcast.language,
        variables,
      });
      sent += 1;
      await prisma.whatsAppBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'sent', wamid: result.messageId || null },
      });
    } catch (error) {
      await prisma.whatsAppBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'failed', error: error instanceof Error ? error.message : 'Send failed' },
      });
    }
  }

  await prisma.whatsAppBroadcast.update({
    where: { id: broadcast.id },
    data: { sentCount: sent, status: sent === sendable.length ? 'sent' : 'partial' },
  });

  return { sent, total: sendable.length };
}

export const broadcastService = {
  async list(scope: ClientScope) {
    const rows = await prisma.whatsAppBroadcast.findMany({
      where: scopeWhere(scope),
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map(mapBroadcastRow);
  },

  async listPending(scope: ClientScope) {
    const rows = await prisma.whatsAppBroadcast.findMany({
      where: { ...scopeWhere(scope), status: 'pending_approval' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return rows.map(mapBroadcastRow);
  },

  async estimate(scope: ClientScope, phones: string[]) {
    await planService.assertFeature(scope.organizationId, 'broadcasts');
    const normalized = normalizePhones(phones);
    const { sendable, optedOut } = await filterSendablePhones(scope.organizationId, normalized);
    const ratePaise = whatsappBroadcastRatePaise();
    const messageCount = sendable.length;
    return {
      totalPhones: normalized.length,
      messageCount,
      optedOutCount: optedOut.length,
      optedOut,
      ratePaise,
      estimatedCostPaise: messageCount * ratePaise,
      estimatedCostInr: (messageCount * ratePaise) / 100,
    };
  },

  /**
   * Client prepares a broadcast; agency must approve before Meta send.
   * Does not call WhatsApp Cloud API.
   */
  async createPending(
    scope: ClientScope,
    input: {
      name: string;
      templateName: string;
      language: string;
      phones: string[];
      variables: string[];
      consentAcknowledged: boolean;
    }
  ) {
    await planService.assertFeature(scope.organizationId, 'broadcasts');
    if (!input.consentAcknowledged) {
      throw new HttpError(400, 'Confirm that recipients have consented to WhatsApp marketing messages');
    }
    const customerId = customerIdForWrite(scope);
    if (!customerId) {
      throw new HttpError(400, 'Pick a single client before preparing a broadcast');
    }

    const normalized = normalizePhones(input.phones);
    if (normalized.length === 0) {
      throw new HttpError(400, 'Add at least one phone number');
    }

    const { sendable, optedOut } = await filterSendablePhones(scope.organizationId, normalized);
    if (sendable.length === 0) {
      throw new HttpError(400, 'All recipients have opted out of broadcasts');
    }

    const ratePaise = whatsappBroadcastRatePaise();
    const estimatedCostPaise = sendable.length * ratePaise;
    const consentAt = new Date();

    const broadcast = await prisma.whatsAppBroadcast.create({
      data: {
        organizationId: scope.organizationId,
        customerId,
        name: input.name,
        templateName: input.templateName,
        language: input.language,
        status: 'pending_approval',
        recipientCount: sendable.length,
        variables: input.variables,
        consentAcknowledged: true,
        consentAt,
        estimatedCostPaise,
        recipients: {
          create: [
            ...sendable.map((phone) => ({ phone })),
            ...optedOut.map((phone) => ({ phone, status: 'skipped_opted_out' })),
          ],
        },
      },
    });

    return {
      id: broadcast.id,
      status: broadcast.status,
      recipientCount: sendable.length,
      skippedOptedOut: optedOut.length,
      estimatedCostPaise,
      consentAt: consentAt.toISOString(),
      needsApproval: true as const,
    };
  },

  async send(
    scope: ClientScope,
    input: {
      name: string;
      templateName: string;
      language: string;
      phones: string[];
      variables: string[];
      consentAcknowledged: boolean;
    }
  ) {
    await planService.assertFeature(scope.organizationId, 'broadcasts');
    if (!input.consentAcknowledged) {
      throw new HttpError(400, 'Confirm that recipients have consented to WhatsApp marketing messages');
    }

    const normalized = normalizePhones(input.phones);
    if (normalized.length === 0) {
      throw new HttpError(400, 'Add at least one phone number');
    }

    const { sendable, optedOut } = await filterSendablePhones(scope.organizationId, normalized);
    if (sendable.length === 0) {
      throw new HttpError(400, 'All recipients have opted out of broadcasts');
    }

    const ratePaise = whatsappBroadcastRatePaise();
    const estimatedCostPaise = sendable.length * ratePaise;
    const consentAt = new Date();

    const broadcast = await prisma.whatsAppBroadcast.create({
      data: {
        organizationId: scope.organizationId,
        customerId: customerIdForWrite(scope),
        name: input.name,
        templateName: input.templateName,
        language: input.language,
        status: 'sending',
        recipientCount: sendable.length,
        variables: input.variables,
        consentAcknowledged: true,
        consentAt,
        estimatedCostPaise,
        recipients: {
          create: [
            ...sendable.map((phone) => ({ phone })),
            ...optedOut.map((phone) => ({ phone, status: 'skipped_opted_out' })),
          ],
        },
      },
      include: { recipients: true },
    });

    const { sent, total } = await deliverBroadcast(scope, broadcast, input.variables);

    return {
      id: broadcast.id,
      sent,
      total,
      skippedOptedOut: optedOut.length,
      estimatedCostPaise,
      consentAt: consentAt.toISOString(),
      needsApproval: false as const,
    };
  },

  /** Agency approves a client-prepared broadcast and sends via the client's number. */
  async approve(scope: ClientScope, broadcastId: string) {
    await planService.assertFeature(scope.organizationId, 'broadcasts');
    const broadcast = await prisma.whatsAppBroadcast.findFirst({
      where: { id: broadcastId, ...scopeWhere(scope), status: 'pending_approval' },
      include: { recipients: true },
    });
    if (!broadcast) throw new HttpError(404, 'Pending broadcast not found');
    if (!broadcast.customerId) {
      throw new HttpError(400, 'Broadcast is not linked to a client');
    }

    const sendableCount = broadcast.recipients.filter(
      (row) => row.status !== 'skipped_opted_out'
    ).length;
    const startOfDay = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate()
      )
    );
    const [customer, sendsUsedToday] = await Promise.all([
      prisma.socialCustomer.findFirst({
        where: {
          id: broadcast.customerId,
          organizationId: scope.organizationId,
          deletedAt: null,
        },
        select: { portalTabs: true },
      }),
      prisma.whatsAppMessage.count({
        where: {
          organizationId: scope.organizationId,
          direction: 'outbound',
          timestamp: { gte: startOfDay },
          conversation: { customerId: broadcast.customerId },
        },
      }),
    ]);
    const dailyCap = portalWhatsAppDailyCap(parsePortalTabsConfig(customer?.portalTabs));
    if (sendsUsedToday + sendableCount > dailyCap) {
      throw new HttpError(
        429,
        `Client daily WhatsApp send limit of ${dailyCap} would be exceeded (${sendsUsedToday} used, ${sendableCount} in this broadcast).`
      );
    }

    const sendScope: ClientScope = {
      organizationId: scope.organizationId,
      customerIds: [broadcast.customerId],
    };
    const variables = variablesFromJson(broadcast.variables);
    const { sent, total } = await deliverBroadcast(sendScope, broadcast, variables);
    const skippedOptedOut = broadcast.recipients.filter((row) => row.status === 'skipped_opted_out')
      .length;

    return {
      id: broadcast.id,
      sent,
      total,
      skippedOptedOut,
      estimatedCostPaise: broadcast.estimatedCostPaise,
      consentAt: broadcast.consentAt?.toISOString() ?? null,
    };
  },

  /** Agency rejects a client-prepared broadcast (no Meta send). */
  async reject(scope: ClientScope, broadcastId: string) {
    const updated = await prisma.whatsAppBroadcast.updateMany({
      where: { id: broadcastId, ...scopeWhere(scope), status: 'pending_approval' },
      data: { status: 'cancelled' },
    });
    if (updated.count === 0) throw new HttpError(404, 'Pending broadcast not found');
    return { id: broadcastId, status: 'cancelled' as const };
  },
};
