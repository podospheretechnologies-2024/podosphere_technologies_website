import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { whatsappBroadcastRatePaise } from '../../config/billing';
import { planService } from '../billing/plan.service';
import { whatsappService } from '../whatsapp/whatsapp.service';

/** Single selected client → that id; 'all' → null (agency-shared connection). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
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
      wabaId: row.wabaId,
      phoneNumberId: row.phoneNumberId,
      displayPhone: row.displayPhone,
      businessName: row.businessName,
      connectedAt: row.createdAt.toISOString(),
    };
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
    return this.connection(scope);
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

  async configureWebhooks(_scope: ClientScope, webhookUrl: string) {
    const env = getServerEnv();
    if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_WEBHOOK_VERIFY_TOKEN) {
      throw new HttpError(400, 'App ID, Secret, and Verify Token are required in .env');
    }
    
    // Get App Token
    const appTokenRes = await fetch(`https://graph.facebook.com/oauth/access_token?client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&grant_type=client_credentials`);
    const { access_token: appToken } = await appTokenRes.json();
    if (!appToken) throw new HttpError(502, 'Could not generate App Token');

    // Subscribe Webhook
    const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_APP_ID}/subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${appToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        object: 'whatsapp_business_account',
        callback_url: webhookUrl,
        verify_token: env.META_WEBHOOK_VERIFY_TOKEN,
        fields: 'messages'
      })
    });
    if (!response.ok) throw new HttpError(502, 'Could not subscribe webhook on Meta');
    return { success: true };
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

export const broadcastService = {
  async list(scope: ClientScope) {
    const rows = await prisma.whatsAppBroadcast.findMany({
      where: scopeWhere(scope),
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      templateName: row.templateName,
      language: row.language,
      status: row.status,
      recipientCount: row.recipientCount,
      sentCount: row.sentCount,
      consentAt: row.consentAt?.toISOString() ?? null,
      estimatedCostPaise: row.estimatedCostPaise,
      createdAt: row.createdAt.toISOString(),
    }));
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

    let sent = 0;
    for (const recipient of broadcast.recipients) {
      if (recipient.status === 'skipped_opted_out') continue;
      try {
        const result = await whatsappService.send(scope, {
          type: 'template',
          to: recipient.phone,
          templateName: input.templateName,
          language: input.language,
          variables: input.variables,
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

    return {
      id: broadcast.id,
      sent,
      total: sendable.length,
      skippedOptedOut: optedOut.length,
      estimatedCostPaise,
      consentAt: consentAt.toISOString(),
    };
  },
};
