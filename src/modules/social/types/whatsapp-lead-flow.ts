import type { WhatsAppChatMessage, WhatsAppConversationItem } from './whatsapp';

/** Automatic WhatsApp messages to new leads, per client. */
export interface WhatsAppLeadFlow {
  enabled: boolean;
  welcomeTemplate: string | null;
  welcomeLanguage: string | null;
  followUp1Template: string | null;
  followUp1Language: string | null;
  /** Hours after the previous message. */
  followUp1AfterHours: number;
  followUp2Template: string | null;
  followUp2Language: string | null;
  followUp2AfterHours: number;
  alertPhone: string | null;
  alertTemplate: string | null;
  alertLanguage: string | null;
}

export interface LeadWhatsAppSendResult {
  sent: string[];
  failed: { leadId: string; name: string; reason: string }[];
}

export interface LeadWhatsAppChat {
  waId: string | null;
  conversation: WhatsAppConversationItem | null;
  messages: WhatsAppChatMessage[];
}
