import 'server-only';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import type {
  SendWhatsAppInput,
  SendWhatsAppResult,
  WhatsAppChatMessage,
  WhatsAppConversationDetail,
  WhatsAppConversationItem,
  WhatsAppNumber,
  WhatsAppOverview,
  WhatsAppTemplate,
} from '../../types/whatsapp';
import { whatsappChatRepository } from './whatsapp-chat.repository';
import { podoCrmWhatsAppSyncService } from '../podocrm/podocrm-whatsapp-sync.service';
import {
  GraphApiError,
  graphGet,
  graphPost,
  type GraphConfig,
  type GraphList,
} from '../integrations/providers/meta/graph-client';

// WhatsApp Cloud API with the Business Manager system user token (WHATSAPP_ACCESS_TOKEN).
// Free-form text only reaches people who messaged the number in the last 24 hours;
// everyone else needs an approved template.

interface GraphPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  status?: string;
  quality_rating?: string;
  messaging_limit_tier?: string;
}

interface GraphTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: { type: string; url?: string }[];
}

interface GraphTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  parameter_format?: 'POSITIONAL' | 'NAMED';
  components: GraphTemplateComponent[];
}

interface GraphSendResponse {
  contacts?: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

interface Credentials {
  graph: GraphConfig;
  token: string;
  phoneNumberId: string;
  wabaId: string | undefined;
}

function credentials(): Credentials {
  const env = getServerEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new HttpError(
      503,
      'WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.'
    );
  }
  return {
    graph: { version: env.META_GRAPH_VERSION, appSecret: env.META_APP_SECRET || undefined },
    token: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    wabaId: env.WHATSAPP_WABA_ID || undefined,
  };
}

// Cloud API error codes: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
function toHttpError(error: unknown): unknown {
  if (!(error instanceof GraphApiError)) {
    return error;
  }
  if (error.isAuthError) {
    return new HttpError(
      503,
      'The WhatsApp token is expired or revoked. Generate a new one for the system user.'
    );
  }
  switch (error.code) {
    case 10:
    case 200:
      return new HttpError(
        403,
        'The token is missing whatsapp_business_messaging / whatsapp_business_management.'
      );
    case 131047:
      return new HttpError(
        422,
        'This person has not messaged you in the last 24 hours, so only a template can be sent to them.'
      );
    case 131026:
      return new HttpError(422, 'Message could not be delivered. Check the number is on WhatsApp.');
    case 131030:
      return new HttpError(
        422,
        'This number is not in the allowed recipients list of the test number.'
      );
    case 132000:
      return new HttpError(422, 'The number of template variables does not match the template.');
    case 132001:
      return new HttpError(422, 'Template not found in this language, or not approved yet.');
    case 131056:
    case 130429:
    case 80007:
      return new HttpError(429, 'WhatsApp rate limit reached. Try again in a few minutes.');
  }
  return new HttpError(502, `Meta: ${error.message}`);
}

async function call<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    throw toHttpError(error);
  }
}

/** Placeholders like {{1}} or {{first_name}}, each once, in order of appearance. */
function placeholdersOf(text: string): string[] {
  const names = [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]);
  return [...new Set(names)];
}

function unsupportedReason(components: GraphTemplateComponent[]): string | null {
  const header = components.find((component) => component.type === 'HEADER');
  if (header && header.format && header.format !== 'TEXT') {
    return `Needs a ${header.format.toLowerCase()} header`;
  }
  if (header?.text && placeholdersOf(header.text).length > 0) {
    return 'Header has variables';
  }
  const buttons = components.find((component) => component.type === 'BUTTONS')?.buttons ?? [];
  if (buttons.some((button) => button.url && placeholdersOf(button.url).length > 0)) {
    return 'Button URL has variables';
  }
  return null;
}

function toTemplate(template: GraphTemplate): WhatsAppTemplate {
  const body = template.components.find((component) => component.type === 'BODY')?.text ?? '';
  return {
    id: template.id,
    name: template.name,
    language: template.language,
    status: template.status,
    category: template.category,
    body,
    variables: placeholdersOf(body),
    parameterFormat: template.parameter_format ?? 'POSITIONAL',
    unsupportedReason: unsupportedReason(template.components),
  };
}

function toNumber(number: GraphPhoneNumber): WhatsAppNumber {
  return {
    id: number.id,
    displayPhoneNumber: number.display_phone_number,
    verifiedName: number.verified_name,
    status: number.status ?? 'UNKNOWN',
    qualityRating: number.quality_rating ?? 'UNKNOWN',
    messagingLimitTier: number.messaging_limit_tier ?? null,
  };
}

async function listTemplates({ graph, token, wabaId }: Credentials): Promise<WhatsAppTemplate[]> {
  if (!wabaId) {
    return [];
  }
  const result = await call(() =>
    graphGet<GraphList<GraphTemplate>>(graph, `${wabaId}/message_templates`, token, {
      fields: 'name,language,status,category,components,parameter_format',
      limit: 200,
    })
  );
  return result.data
    .map(toTemplate)
    .sort(
      (a, b) =>
        Number(b.status === 'APPROVED') - Number(a.status === 'APPROVED') ||
        a.name.localeCompare(b.name)
    );
}

function withinWindow(lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) {
    return false;
  }
  return Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
}

function toConversationItem(
  row: Awaited<ReturnType<typeof whatsappChatRepository.listConversations>>[number]
): WhatsAppConversationItem {
  return {
    id: row.id,
    waId: row.waId,
    contactName: row.contactName,
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastInboundAt: row.lastInboundAt?.toISOString() ?? null,
    lastPreview: row.lastPreview,
    unreadCount: row.unreadCount,
    withinWindow: withinWindow(row.lastInboundAt),
  };
}

function toChatMessage(
  row: Awaited<ReturnType<typeof whatsappChatRepository.listMessages>>[number]
): WhatsAppChatMessage {
  return {
    id: row.id,
    wamid: row.wamid,
    direction: row.direction === 'inbound' ? 'inbound' : 'outbound',
    type: row.type,
    body: row.body,
    status: row.status,
    timestamp: row.timestamp.toISOString(),
  };
}

async function recordOutbound(
  organizationId: string,
  to: string,
  body: string,
  messageId: string,
  waId: string | null
) {
  const contactId = waId ?? to;
  const timestamp = new Date();
  const conversation = await whatsappChatRepository.upsertConversation({
    organizationId,
    waId: contactId,
    preview: body,
    timestamp,
    inbound: false,
  });
  await whatsappChatRepository.createMessage({
    organizationId,
    conversationId: conversation.id,
    wamid: messageId || null,
    direction: 'outbound',
    type: 'text',
    body,
    status: 'sent',
    timestamp,
  });
}

export const whatsappService = {
  isConfigured(): boolean {
    const env = getServerEnv();
    return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
  },

  async overview(): Promise<WhatsAppOverview> {
    const creds = credentials();
    const [number, templates] = await Promise.all([
      call(() =>
        graphGet<GraphPhoneNumber>(creds.graph, creds.phoneNumberId, creds.token, {
          fields: 'display_phone_number,verified_name,status,quality_rating,messaging_limit_tier',
        })
      ),
      listTemplates(creds),
    ]);
    return {
      configured: true,
      number: toNumber(number),
      templates,
      templatesAvailable: Boolean(creds.wabaId),
    };
  },

  async listConversations(organizationId: string): Promise<WhatsAppConversationItem[]> {
    const rows = await whatsappChatRepository.listConversations(organizationId);
    return rows.map(toConversationItem);
  },

  async getConversation(
    organizationId: string,
    conversationId: string
  ): Promise<WhatsAppConversationDetail> {
    const conversation = await whatsappChatRepository.findConversationById(
      organizationId,
      conversationId
    );
    if (!conversation) {
      throw new HttpError(404, 'Conversation not found');
    }
    await whatsappChatRepository.markRead(organizationId, conversationId);
    const messages = await whatsappChatRepository.listMessages(organizationId, conversationId);
    return {
      conversation: toConversationItem({ ...conversation, unreadCount: 0 }),
      messages: messages.map(toChatMessage),
    };
  },

  async send(organizationId: string, input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    const creds = credentials();
    const message =
      input.type === 'text'
        ? { type: 'text', text: { body: input.text, preview_url: true } }
        : { type: 'template', template: await templatePayload(creds, input) };

    const response = await call(() =>
      graphPost<GraphSendResponse>(creds.graph, `${creds.phoneNumberId}/messages`, creds.token, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: input.to,
        ...message,
      })
    );
    const result = {
      messageId: response.messages[0]?.id ?? '',
      waId: response.contacts?.[0]?.wa_id ?? null,
    };

    const preview =
      input.type === 'text'
        ? input.text
        : `Template: ${input.templateName}${input.variables.length ? ` (${input.variables.join(', ')})` : ''}`;
    await recordOutbound(organizationId, input.to, preview, result.messageId, result.waId);

    void podoCrmWhatsAppSyncService.echoOutbound(organizationId, {
      wamid: result.messageId,
      to: result.waId ?? input.to,
      type: input.type,
      text: input.type === 'text' ? input.text : undefined,
      templateName: input.type === 'template' ? input.templateName : undefined,
      language: input.type === 'template' ? input.language : undefined,
    });

    return result;
  },
};

async function templatePayload(
  creds: Credentials,
  input: Extract<SendWhatsAppInput, { type: 'template' }>
) {
  // With the WABA id we can check the template up front and get named parameters right.
  const template = (await listTemplates(creds)).find(
    (item) => item.name === input.templateName && item.language === input.language
  );
  if (creds.wabaId && !template) {
    throw new HttpError(404, 'Template not found');
  }
  if (template) {
    if (template.status !== 'APPROVED') {
      throw new HttpError(422, `Template is ${template.status.toLowerCase()}, not approved`);
    }
    if (template.unsupportedReason) {
      throw new HttpError(
        422,
        `This template can't be sent from here yet: ${template.unsupportedReason}`
      );
    }
    if (template.variables.length !== input.variables.length) {
      throw new HttpError(400, `This template needs ${template.variables.length} variable(s)`);
    }
  }

  const named = template?.parameterFormat === 'NAMED';
  const parameters = input.variables.map((text, index) => ({
    type: 'text',
    text,
    ...(named ? { parameter_name: template.variables[index] } : {}),
  }));

  return {
    name: input.templateName,
    language: { code: input.language },
    ...(parameters.length ? { components: [{ type: 'body', parameters }] } : {}),
  };
}
