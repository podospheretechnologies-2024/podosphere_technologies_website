import 'server-only';
import { z } from 'zod';
import type { SocialLead, SocialWhatsAppLeadFlow } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { organizationScope, scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import type { WhatsAppTemplate } from '../../types/whatsapp';
import type { WhatsAppLeadFlow } from '../../types/whatsapp-lead-flow';
import { computeLeadScore, scoreReasonsToJson } from '../inbox/lead-score';
import { notificationService } from '../notifications/notification.service';
import { toWaId } from './wa-id';
import { whatsappChatRepository } from './whatsapp-chat.repository';
import { whatsappService } from './whatsapp.service';

// WhatsApp messages to leads: automatic welcome + follow-ups, an alert to the sales person,
// manual sends from the Leads page, and leads created from click-to-WhatsApp ads.

const SENDER_LABEL = 'Lead flow';
const HOUR_MS = 60 * 60 * 1000;
const FOLLOW_UP_BATCH = 50;
const MANUAL_SEND_MAX = 100;
const templateName = z.string().trim().max(120).nullable();
const templateLanguage = z.string().trim().max(16).nullable();
const afterHours = z.number().int().min(1).max(24 * 30);

export const saveLeadFlowSchema = z.object({
  enabled: z.boolean(),
  welcomeTemplate: templateName,
  welcomeLanguage: templateLanguage,
  followUp1Template: templateName,
  followUp1Language: templateLanguage,
  followUp1AfterHours: afterHours,
  followUp2Template: templateName,
  followUp2Language: templateLanguage,
  followUp2AfterHours: afterHours,
  alertPhone: z.string().trim().max(32).nullable(),
  alertTemplate: templateName,
  alertLanguage: templateLanguage,
});

export const sendLeadTemplateSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(MANUAL_SEND_MAX),
  templateName: z.string().trim().min(1).max(120),
  language: z.string().trim().min(1).max(16),
});

function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

function sourceLabel(lead: Pick<SocialLead, 'source' | 'payload'>): string {
  const payload = (lead.payload ?? {}) as Record<string, unknown>;
  const ad = payload.ad_name ?? payload.campaign_name ?? payload.headline;
  if (typeof ad === 'string' && ad.trim()) return ad.trim().slice(0, 60);
  return lead.source === 'whatsapp_ad' ? 'WhatsApp ad' : `${lead.source} lead form`;
}

/**
 * Values for a template's placeholders, taken from the lead.
 * {{1}} name, {{2}} phone, {{3}} email, {{4}} where the lead came from. Named placeholders
 * are matched by their name first (first_name, phone, email, source).
 */
function variablesFor(template: WhatsAppTemplate, lead: SocialLead): string[] {
  const name = lead.name?.trim() || 'there';
  const phone = lead.phone?.trim() || (lead.waId ? `+${lead.waId}` : '-');
  const email = lead.email?.trim() || '-';
  const source = sourceLabel(lead);
  const byOrder = [name, phone, email, source];
  return template.variables.map((variable, index) => {
    const key = variable.toLowerCase();
    if (key.includes('name')) return name;
    if (key.includes('phone') || key.includes('mobile') || key.includes('number')) return phone;
    if (key.includes('mail')) return email;
    if (key.includes('source') || key.includes('campaign')) return source;
    return byOrder[index] ?? '-';
  });
}

function toFlow(row: SocialWhatsAppLeadFlow | null): WhatsAppLeadFlow {
  return {
    enabled: row?.enabled ?? false,
    welcomeTemplate: row?.welcomeTemplate ?? null,
    welcomeLanguage: row?.welcomeLanguage ?? null,
    followUp1Template: row?.followUp1Template ?? null,
    followUp1Language: row?.followUp1Language ?? null,
    followUp1AfterHours: row?.followUp1AfterHours ?? 24,
    followUp2Template: row?.followUp2Template ?? null,
    followUp2Language: row?.followUp2Language ?? null,
    followUp2AfterHours: row?.followUp2AfterHours ?? 48,
    alertPhone: row?.alertPhone ?? null,
    alertTemplate: row?.alertTemplate ?? null,
    alertLanguage: row?.alertLanguage ?? null,
  };
}

function flowFor(organizationId: string, customerId: string | null) {
  return prisma.socialWhatsAppLeadFlow.findFirst({ where: { organizationId, customerId } });
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : 'Could not send').slice(0, 500);
}

/** Sends one template to the lead's own number. Throws when it cannot be sent. */
async function sendToLead(lead: SocialLead, waId: string, name: string, language: string) {
  const conversation = await whatsappChatRepository.findConversation(lead.organizationId, waId);
  if (conversation?.optedOutAt) {
    throw new HttpError(422, 'This person asked to stop receiving messages');
  }
  const scope = organizationScope(lead.organizationId, lead.customerId);
  const template = (await whatsappService.templates(scope)).find(
    (item) => item.name === name && item.language === language
  );
  if (!template) throw new HttpError(404, `Template "${name}" was not found for this number`);
  await whatsappService.send(
    scope,
    {
      type: 'template',
      to: waId,
      templateName: name,
      language,
      variables: variablesFor(template, lead),
    },
    { senderName: SENDER_LABEL }
  );
}

/** Tells the sales person about a new lead. Never throws. */
async function alertTeam(lead: SocialLead, flow: SocialWhatsAppLeadFlow | null) {
  const to = toWaId(flow?.alertPhone);
  if (!flow || !to || !flow.alertTemplate || !flow.alertLanguage) return;
  try {
    const scope = organizationScope(lead.organizationId, lead.customerId);
    const template = (await whatsappService.templates(scope)).find(
      (item) => item.name === flow.alertTemplate && item.language === flow.alertLanguage
    );
    if (!template) throw new Error(`Template "${flow.alertTemplate}" was not found`);
    await whatsappService.send(
      scope,
      {
        type: 'template',
        to,
        templateName: template.name,
        language: template.language,
        variables: variablesFor(template, lead),
      },
      { senderName: SENDER_LABEL }
    );
  } catch (error) {
    console.error(`[lead-flow] team alert failed lead=${lead.id}: ${errorText(error)}`);
  }
}

export const leadWhatsAppService = {
  async getFlow(scope: ClientScope): Promise<WhatsAppLeadFlow> {
    return toFlow(await flowFor(scope.organizationId, customerIdForWrite(scope)));
  },

  async saveFlow(
    scope: ClientScope,
    body: z.infer<typeof saveLeadFlowSchema>
  ): Promise<WhatsAppLeadFlow> {
    if (body.enabled && (!body.welcomeTemplate || !body.welcomeLanguage)) {
      throw new HttpError(400, 'Choose the welcome template before switching this on');
    }
    if (body.alertPhone && !toWaId(body.alertPhone)) {
      throw new HttpError(400, 'The sales phone number does not look right. Include the country code.');
    }
    const customerId = customerIdForWrite(scope);
    const existing = await flowFor(scope.organizationId, customerId);
    const data = { ...body, alertPhone: body.alertPhone || null };
    const row = existing
      ? await prisma.socialWhatsAppLeadFlow.update({ where: { id: existing.id }, data })
      : await prisma.socialWhatsAppLeadFlow.create({
          data: { ...data, organizationId: scope.organizationId, customerId },
        });
    return toFlow(row);
  },

  /** New lead from an ad form: alert the team, send the welcome, schedule the follow-up. Never throws. */
  async onNewLead(leadId: string): Promise<void> {
    try {
      const lead = await prisma.socialLead.findUnique({ where: { id: leadId } });
      if (!lead) return;
      const flow = await flowFor(lead.organizationId, lead.customerId);
      await alertTeam(lead, flow);

      if (!flow?.enabled || !flow.welcomeTemplate || !flow.welcomeLanguage) return;
      if (lead.waStep > 0) return;
      const waId = lead.waId ?? toWaId(lead.phone);
      if (!waId) {
        await prisma.socialLead.update({
          where: { id: lead.id },
          data: { waError: 'No usable phone number on this lead' },
        });
        return;
      }
      try {
        await sendToLead(lead, waId, flow.welcomeTemplate, flow.welcomeLanguage);
        const now = new Date();
        await prisma.socialLead.update({
          where: { id: lead.id },
          data: {
            waId,
            waStep: 1,
            waLastSentAt: now,
            waError: null,
            waNextAt: flow.followUp1Template
              ? new Date(now.getTime() + flow.followUp1AfterHours * HOUR_MS)
              : null,
          },
        });
      } catch (error) {
        await prisma.socialLead.update({
          where: { id: lead.id },
          data: { waId, waError: errorText(error) },
        });
      }
    } catch (error) {
      console.error(`[lead-flow] onNewLead failed lead=${leadId}: ${errorText(error)}`);
    }
  },

  /** Worker job: send follow-ups that are due to leads who have not replied. */
  async runFollowUps(): Promise<{ sent: number; stopped: number }> {
    const due = await prisma.socialLead.findMany({
      where: { waNextAt: { lte: new Date() } },
      orderBy: { waNextAt: 'asc' },
      take: FOLLOW_UP_BATCH,
    });
    let sent = 0;
    let stopped = 0;

    for (const lead of due) {
      // Claim the lead so two runs can never send the same follow-up twice.
      const claimed = await prisma.socialLead.updateMany({
        where: { id: lead.id, waNextAt: lead.waNextAt },
        data: { waNextAt: null },
      });
      if (claimed.count === 0) continue;

      const flow = await flowFor(lead.organizationId, lead.customerId);
      const step =
        lead.waStep === 1
          ? { name: flow?.followUp1Template, language: flow?.followUp1Language }
          : lead.waStep === 2
            ? { name: flow?.followUp2Template, language: flow?.followUp2Language }
            : null;
      const stillOpen = lead.stage === 'new' || lead.stage === 'contacted';
      if (!flow?.enabled || !step?.name || !step.language || !lead.waId || lead.waRepliedAt || !stillOpen) {
        stopped += 1;
        continue;
      }

      try {
        await sendToLead(lead, lead.waId, step.name, step.language);
        const now = new Date();
        await prisma.socialLead.update({
          where: { id: lead.id },
          data: {
            waStep: lead.waStep + 1,
            waLastSentAt: now,
            waError: null,
            waNextAt:
              lead.waStep === 1 && flow.followUp2Template
                ? new Date(now.getTime() + flow.followUp2AfterHours * HOUR_MS)
                : null,
          },
        });
        sent += 1;
      } catch (error) {
        // No retry: a failed follow-up ends the sequence and shows on the lead.
        await prisma.socialLead.update({
          where: { id: lead.id },
          data: { waError: errorText(error) },
        });
        stopped += 1;
      }
    }
    return { sent, stopped };
  },

  /** A contact messaged the number: stop their follow-ups and mark messaged leads as contacted. */
  async onInbound(organizationId: string, waId: string): Promise<void> {
    try {
      const leads = await prisma.socialLead.findMany({
        where: { organizationId, waId, waRepliedAt: null },
      });
      for (const lead of leads) {
        const moveStage = lead.stage === 'new' && lead.waStep > 0;
        const scored = moveStage
          ? computeLeadScore({
              stage: 'contacted',
              name: lead.name,
              email: lead.email,
              phone: lead.phone,
              payload: lead.payload,
            })
          : null;
        await prisma.socialLead.update({
          where: { id: lead.id },
          data: {
            waRepliedAt: new Date(),
            waNextAt: null,
            ...(scored
              ? {
                  stage: 'contacted',
                  score: scored.score,
                  scoreReasons: scoreReasonsToJson(scored.reasons),
                  scoredAt: new Date(),
                }
              : {}),
          },
        });
      }
    } catch (error) {
      console.error(`[lead-flow] onInbound failed waId=${waId}: ${errorText(error)}`);
    }
  },

  /** First message of a chat that came from a click-to-WhatsApp ad: keep it as a lead. Never throws. */
  async onAdChat(input: {
    organizationId: string;
    customerId: string | null;
    waId: string;
    contactName: string | null;
    referral: Record<string, unknown>;
  }): Promise<void> {
    try {
      const key = {
        organizationId: input.organizationId,
        source: 'whatsapp_ad',
        externalId: input.waId,
      };
      const existing = await prisma.socialLead.findUnique({
        where: { organizationId_source_externalId: key },
        select: { id: true },
      });
      if (existing) return;

      const phone = `+${input.waId}`;
      const payload = JSON.parse(JSON.stringify(input.referral)) as object;
      const scored = computeLeadScore({
        stage: 'new',
        name: input.contactName,
        email: null,
        phone,
        payload,
      });
      const lead = await prisma.socialLead.create({
        data: {
          ...key,
          customerId: input.customerId,
          name: input.contactName,
          phone,
          waId: input.waId,
          waRepliedAt: new Date(),
          stage: 'new',
          score: scored.score,
          scoreReasons: scoreReasonsToJson(scored.reasons),
          scoredAt: new Date(),
          payload,
        },
      });
      void notificationService
        .newLead(input.organizationId, 'a WhatsApp ad', lead.id)
        .catch((error) => console.error('[lead-flow] new_lead notify failed', error));
      await alertTeam(lead, await flowFor(lead.organizationId, lead.customerId));
    } catch (error) {
      console.error(`[lead-flow] onAdChat failed waId=${input.waId}: ${errorText(error)}`);
    }
  },

  /** Manual send from the Leads page. Reports each lead that could not be messaged. */
  async sendTemplate(scope: ClientScope, body: z.infer<typeof sendLeadTemplateSchema>) {
    const leads = await prisma.socialLead.findMany({
      where: { id: { in: body.leadIds }, ...scopeWhere(scope) },
    });
    if (leads.length === 0) throw new HttpError(404, 'No matching leads found');

    const sent: string[] = [];
    const failed: { leadId: string; name: string; reason: string }[] = [];
    for (const lead of leads) {
      const name = lead.name || lead.phone || 'Untitled lead';
      const waId = lead.waId ?? toWaId(lead.phone);
      if (!waId) {
        failed.push({ leadId: lead.id, name, reason: 'No usable phone number' });
        continue;
      }
      try {
        await sendToLead(lead, waId, body.templateName, body.language);
        await prisma.socialLead.update({
          where: { id: lead.id },
          data: {
            waId,
            waStep: Math.max(lead.waStep, 1),
            waLastSentAt: new Date(),
            waError: null,
          },
        });
        sent.push(lead.id);
      } catch (error) {
        failed.push({ leadId: lead.id, name, reason: errorText(error) });
      }
    }
    return { sent, failed };
  },

  /** The WhatsApp chat with one lead, for the Leads page. */
  async chat(scope: ClientScope, leadId: string) {
    const lead = await prisma.socialLead.findFirst({ where: { id: leadId, ...scopeWhere(scope) } });
    if (!lead) throw new HttpError(404, 'Lead not found');
    const waId = lead.waId ?? toWaId(lead.phone);
    const detail = waId ? await whatsappService.conversationByWaId(lead.organizationId, waId) : null;
    return { waId, conversation: detail?.conversation ?? null, messages: detail?.messages ?? [] };
  },
};
