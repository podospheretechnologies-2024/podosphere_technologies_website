import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { organizationScope, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import type {
  WhatsAppAdChatRow,
  WhatsAppAgencyNotify,
  WhatsAppClientNotify,
} from '../../types/whatsapp-agency';
import { toWaId } from './wa-id';
import { whatsappService } from './whatsapp.service';

const templateName = z.string().trim().max(120).nullable();
const templateLanguage = z.string().trim().max(16).nullable();

export const saveAgencyNotifySchema = z.object({
  reportTemplate: templateName,
  reportLanguage: templateLanguage,
  approvalTemplate: templateName,
  approvalLanguage: templateLanguage,
  paymentTemplate: templateName,
  paymentLanguage: templateLanguage,
});

export const saveClientNotifySchema = z.object({
  customerId: z.string().min(1),
  phone: z.string().trim().max(32).nullable(),
  reportEnabled: z.boolean(),
  approvalEnabled: z.boolean(),
  paymentEnabled: z.boolean(),
});

const SENDER = 'Agency notify';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Stop nagging after this many reminders for the same set of waiting posts. */
const MAX_APPROVAL_REMINDERS = 3;

function toAgency(row: {
  reportTemplate: string | null;
  reportLanguage: string | null;
  approvalTemplate: string | null;
  approvalLanguage: string | null;
  paymentTemplate: string | null;
  paymentLanguage: string | null;
} | null): WhatsAppAgencyNotify {
  return {
    reportTemplate: row?.reportTemplate ?? null,
    reportLanguage: row?.reportLanguage ?? null,
    approvalTemplate: row?.approvalTemplate ?? null,
    approvalLanguage: row?.approvalLanguage ?? null,
    paymentTemplate: row?.paymentTemplate ?? null,
    paymentLanguage: row?.paymentLanguage ?? null,
  };
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getServerEnv().APP_URL.replace(/\/$/, '');
  return `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function portalContentUrl(): string {
  return absoluteUrl('/portal/content');
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Reminders only go out between 10:00 and 19:00 India time, never in the night. */
function insideSendingHours(now: Date): boolean {
  const istHour = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
  return istHour >= 10 && istHour < 19;
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : 'Could not send').slice(0, 500);
}

export const agencyWhatsAppService = {
  async getAgencyNotify(organizationId: string): Promise<WhatsAppAgencyNotify> {
    const row = await prisma.socialWhatsAppAgencyNotify.findUnique({ where: { organizationId } });
    return toAgency(row);
  },

  async saveAgencyNotify(
    organizationId: string,
    body: z.infer<typeof saveAgencyNotifySchema>
  ): Promise<WhatsAppAgencyNotify> {
    const row = await prisma.socialWhatsAppAgencyNotify.upsert({
      where: { organizationId },
      create: { organizationId, ...body },
      update: body,
    });
    return toAgency(row);
  },

  async listClientNotify(organizationId: string): Promise<WhatsAppClientNotify[]> {
    const rows = await prisma.socialCustomer.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        whatsappPhone: true,
        whatsappReportEnabled: true,
        whatsappApprovalEnabled: true,
        whatsappPaymentEnabled: true,
      },
    });
    return rows.map((row) => ({
      customerId: row.id,
      customerName: row.name,
      phone: row.whatsappPhone,
      reportEnabled: row.whatsappReportEnabled,
      approvalEnabled: row.whatsappApprovalEnabled,
      paymentEnabled: row.whatsappPaymentEnabled,
    }));
  },

  async saveClientNotify(
    organizationId: string,
    body: z.infer<typeof saveClientNotifySchema>
  ): Promise<WhatsAppClientNotify> {
    if (body.phone && !toWaId(body.phone)) {
      throw new HttpError(400, 'Client WhatsApp number needs a country code, e.g. +9198…');
    }
    if (
      (body.reportEnabled || body.approvalEnabled || body.paymentEnabled) &&
      !toWaId(body.phone)
    ) {
      throw new HttpError(400, 'Add a WhatsApp number before switching a reminder on');
    }
    const row = await prisma.socialCustomer.updateMany({
      where: { id: body.customerId, organizationId, deletedAt: null },
      data: {
        whatsappPhone: body.phone || null,
        whatsappReportEnabled: body.reportEnabled,
        whatsappApprovalEnabled: body.approvalEnabled,
        whatsappPaymentEnabled: body.paymentEnabled,
      },
    });
    if (row.count === 0) throw new HttpError(404, 'Client not found');
    const client = await prisma.socialCustomer.findFirstOrThrow({
      where: { id: body.customerId, organizationId },
      select: {
        id: true,
        name: true,
        whatsappPhone: true,
        whatsappReportEnabled: true,
        whatsappApprovalEnabled: true,
        whatsappPaymentEnabled: true,
      },
    });
    return {
      customerId: client.id,
      customerName: client.name,
      phone: client.whatsappPhone,
      reportEnabled: client.whatsappReportEnabled,
      approvalEnabled: client.whatsappApprovalEnabled,
      paymentEnabled: client.whatsappPaymentEnabled,
    };
  },

  /** After a monthly PDF is ready: send it on WhatsApp when the client switch is on. Never throws. */
  async sendMonthlyReport(opts: {
    organizationId: string;
    customerId: string;
    clientName: string;
    title: string;
    periodLabel: string;
    pdfUrl: string | null;
    leads?: number;
    spend?: number;
    costPerLead?: number | null;
  }): Promise<void> {
    try {
      const customer = await prisma.socialCustomer.findFirst({
        where: { id: opts.customerId, organizationId: opts.organizationId, deletedAt: null },
        select: { whatsappPhone: true, whatsappReportEnabled: true },
      });
      const to = toWaId(customer?.whatsappPhone);
      if (!customer?.whatsappReportEnabled || !to || !opts.pdfUrl) return;

      const agency = await this.getAgencyNotify(opts.organizationId);
      if (!agency.reportTemplate || !agency.reportLanguage) return;

      const scope = organizationScope(opts.organizationId, opts.customerId);
      const leads = opts.leads ?? 0;
      const spend = opts.spend ?? 0;
      const cpl =
        opts.costPerLead != null
          ? opts.costPerLead.toFixed(0)
          : leads > 0
            ? (spend / leads).toFixed(0)
            : '-';
      const spendText = `₹${Math.round(spend).toLocaleString('en-IN')}`;
      const pool = [opts.clientName, String(leads), spendText, cpl === '-' ? '-' : `₹${cpl}`];
      const template = (await whatsappService.templates(scope)).find(
        (item) => item.name === agency.reportTemplate && item.language === agency.reportLanguage
      );
      await whatsappService.send(
        scope,
        {
          type: 'template',
          to,
          templateName: agency.reportTemplate,
          language: agency.reportLanguage,
          variables: pool.slice(0, template?.variables.length ?? pool.length),
          headerDocumentUrl: absoluteUrl(opts.pdfUrl),
          headerDocumentFilename: `${opts.title.replace(/[^\w.-]+/g, '_')}.pdf`,
        },
        { senderName: SENDER }
      );
    } catch (error) {
      console.error(
        `[agency-wa] monthly report failed customer=${opts.customerId}: ${errorText(error)}`
      );
    }
  },

  /** Daily: remind clients with posts waiting on client approval (max 3 for the same set). */
  async runApprovalReminders(): Promise<{ sent: number }> {
    if (!insideSendingHours(new Date())) return { sent: 0 };
    const agencyByOrg = new Map<string, WhatsAppAgencyNotify>();
    const clients = await prisma.socialCustomer.findMany({
      where: { deletedAt: null, whatsappApprovalEnabled: true, whatsappPhone: { not: null } },
      select: {
        id: true,
        name: true,
        organizationId: true,
        whatsappPhone: true,
        whatsappApprovalLastAt: true,
        whatsappApprovalRemindCount: true,
        whatsappApprovalRemindKey: true,
      },
    });
    let sent = 0;
    const now = new Date();

    for (const client of clients) {
      const to = toWaId(client.whatsappPhone);
      if (!to) continue;
      if (
        client.whatsappApprovalLastAt &&
        now.getTime() - client.whatsappApprovalLastAt.getTime() < DAY_MS
      ) {
        continue;
      }

      const pendingPosts = await prisma.socialPost.findMany({
        where: {
          organizationId: client.organizationId,
          customerId: client.id,
          deletedAt: null,
          state: 'DRAFT',
          approvalStep: 'CLIENT',
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      if (pendingPosts.length === 0) {
        if (client.whatsappApprovalRemindCount > 0 || client.whatsappApprovalRemindKey) {
          await prisma.socialCustomer.update({
            where: { id: client.id },
            data: { whatsappApprovalRemindCount: 0, whatsappApprovalRemindKey: null },
          });
        }
        continue;
      }

      const remindKey = createHash('sha256')
        .update(pendingPosts.map((post) => post.id).join(','))
        .digest('hex')
        .slice(0, 40);
      const sameBatch = client.whatsappApprovalRemindKey === remindKey;
      const remindCount = sameBatch ? client.whatsappApprovalRemindCount : 0;
      if (remindCount >= MAX_APPROVAL_REMINDERS) continue;

      let agency = agencyByOrg.get(client.organizationId);
      if (!agency) {
        agency = await this.getAgencyNotify(client.organizationId);
        agencyByOrg.set(client.organizationId, agency);
      }
      if (!agency.approvalTemplate || !agency.approvalLanguage) continue;

      try {
        const scope = organizationScope(client.organizationId, client.id);
        const template = (await whatsappService.templates(scope)).find(
          (item) =>
            item.name === agency.approvalTemplate && item.language === agency.approvalLanguage
        );
        const pool = [client.name, String(pendingPosts.length), portalContentUrl()];
        const buttonUrlParams =
          (template?.buttonUrlParamCount ?? 0) > 0 ? ['portal/content'] : undefined;
        await whatsappService.send(
          scope,
          {
            type: 'template',
            to,
            templateName: agency.approvalTemplate,
            language: agency.approvalLanguage,
            variables: pool.slice(0, template?.variables.length ?? 2),
            buttonUrlParams,
          },
          { senderName: SENDER }
        );
        await prisma.socialCustomer.update({
          where: { id: client.id },
          data: {
            whatsappApprovalLastAt: now,
            whatsappApprovalRemindKey: remindKey,
            whatsappApprovalRemindCount: remindCount + 1,
          },
        });
        sent += 1;
      } catch (error) {
        console.error(`[agency-wa] approval remind failed client=${client.id}: ${errorText(error)}`);
      }
    }
    return { sent };
  },

  /**
   * Payment due in 3 days or today, for clients with the switch on.
   * At most one reminder per client per day: the job runs hourly, and a client with two
   * payments due must not get a message every hour.
   */
  async runPaymentReminders(): Promise<{ sent: number }> {
    const now = new Date();
    if (!insideSendingHours(now)) return { sent: 0 };
    const today = startOfUtcDay(now);
    const inThree = new Date(today.getTime() + 3 * DAY_MS);
    const dayKey = today.toISOString().slice(0, 10);
    const payments = await prisma.opsPayment.findMany({
      where: {
        deletedAt: null,
        paidAt: null,
        dueDate: { in: [today, inThree] },
        client: { deletedAt: null, socialCustomerId: { not: null } },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        client: { select: { socialCustomerId: true, name: true, organizationId: true } },
      },
    });

    // One message per client: total of what is due, and the earliest due date.
    const byCustomer = new Map<
      string,
      { organizationId: string; total: number; hasAmount: boolean; dueDate: Date }
    >();
    for (const payment of payments) {
      const customerId = payment.client.socialCustomerId;
      if (!customerId || !payment.dueDate) continue;
      const entry = byCustomer.get(customerId) ?? {
        organizationId: payment.organizationId,
        total: 0,
        hasAmount: false,
        dueDate: payment.dueDate,
      };
      if (payment.amount != null) {
        entry.total += Number(payment.amount);
        entry.hasAmount = true;
      }
      byCustomer.set(customerId, entry);
    }

    let sent = 0;
    for (const [customerId, due] of byCustomer) {
      const customer = await prisma.socialCustomer.findFirst({
        where: {
          id: customerId,
          organizationId: due.organizationId,
          deletedAt: null,
          whatsappPaymentEnabled: true,
        },
        select: { id: true, name: true, whatsappPhone: true, whatsappPaymentLastKey: true },
      });
      const to = toWaId(customer?.whatsappPhone);
      if (!customer || !to) continue;
      if (customer.whatsappPaymentLastKey === dayKey) continue;

      const agency = await this.getAgencyNotify(due.organizationId);
      if (!agency.paymentTemplate || !agency.paymentLanguage) continue;

      const amount = due.hasAmount ? `₹${due.total.toLocaleString('en-IN')}` : 'your invoice';
      const dueText = due.dueDate.toISOString().slice(0, 10);
      try {
        const scope = organizationScope(due.organizationId, customer.id);
        const template = (await whatsappService.templates(scope)).find(
          (item) =>
            item.name === agency.paymentTemplate && item.language === agency.paymentLanguage
        );
        const pool = [customer.name, amount, dueText];
        await whatsappService.send(
          scope,
          {
            type: 'template',
            to,
            templateName: agency.paymentTemplate,
            language: agency.paymentLanguage,
            variables: pool.slice(0, template?.variables.length ?? pool.length),
          },
          { senderName: SENDER }
        );
        await prisma.socialCustomer.update({
          where: { id: customer.id },
          data: { whatsappPaymentLastKey: dayKey },
        });
        sent += 1;
      } catch (error) {
        console.error(`[agency-wa] payment remind failed client=${customer.id}: ${errorText(error)}`);
      }
    }
    return { sent };
  },

  /** Click-to-WhatsApp ad performance for the selected client scope. */
  async adChatSummary(scope: ClientScope): Promise<WhatsAppAdChatRow[]> {
    const where = {
      ...{ organizationId: scope.organizationId },
      ...(scope.customerIds === 'all' ? {} : { customerId: { in: scope.customerIds } }),
      adSourceId: { not: null },
    };
    const conversations = await prisma.whatsAppConversation.findMany({
      where,
      select: {
        adSourceId: true,
        adHeadline: true,
        lastInboundAt: true,
        waId: true,
      },
    });

    const byAd = new Map<
      string,
      { headline: string; chats: number; replies: number; waIds: Set<string> }
    >();
    for (const row of conversations) {
      const id = row.adSourceId!;
      const entry = byAd.get(id) ?? {
        headline: row.adHeadline || 'WhatsApp ad',
        chats: 0,
        replies: 0,
        waIds: new Set<string>(),
      };
      entry.chats += 1;
      if (row.lastInboundAt) entry.replies += 1;
      entry.waIds.add(row.waId);
      if (row.adHeadline) entry.headline = row.adHeadline;
      byAd.set(id, entry);
    }

    const wonByWaId = await prisma.socialLead.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(scope.customerIds === 'all' ? {} : { customerId: { in: scope.customerIds } }),
        source: 'whatsapp_ad',
        stage: 'won',
        waId: { not: null },
      },
      select: { waId: true },
    });
    const wonIds = new Set(wonByWaId.map((row) => row.waId).filter(Boolean) as string[]);

    return [...byAd.entries()]
      .map(([adSourceId, entry]) => ({
        adSourceId,
        adHeadline: entry.headline,
        chatsStarted: entry.chats,
        replies: entry.replies,
        leadsWon: [...entry.waIds].filter((id) => wonIds.has(id)).length,
      }))
      .sort((a, b) => b.chatsStarted - a.chatsStarted);
  },
};
