export interface WhatsAppNumber {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  /** CONNECTED, PENDING, FLAGGED, … */
  status: string;
  /** GREEN, YELLOW, RED or UNKNOWN. */
  qualityRating: string;
  /** e.g. TIER_250, TIER_1K. Absent until Meta assigns one. */
  messagingLimitTier: string | null;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  /** APPROVED, PENDING, REJECTED, PAUSED, … */
  status: string;
  category: string;
  /** Body text with {{1}} / {{name}} placeholders. */
  body: string;
  /** Placeholders in the body, in order. Empty when the template has none. */
  variables: string[];
  /** POSITIONAL ({{1}}) or NAMED ({{first_name}}). */
  parameterFormat: 'POSITIONAL' | 'NAMED';
  /** Set when the template needs a header image/video or button values we can't fill in yet. */
  unsupportedReason: string | null;
}

export interface WhatsAppOverview {
  configured: boolean;
  number: WhatsAppNumber | null;
  templates: WhatsAppTemplate[];
  /** False when WHATSAPP_WABA_ID is missing, so templates can't be listed. */
  templatesAvailable: boolean;
}

export type SendWhatsAppInput =
  | { type: 'text'; to: string; text: string }
  | {
      type: 'template';
      to: string;
      templateName: string;
      language: string;
      /** Values for the body placeholders, in the template's order. */
      variables: string[];
    };

export interface SendWhatsAppResult {
  messageId: string;
  /** The recipient's WhatsApp id as Meta resolved it. */
  waId: string | null;
}

export interface WhatsAppConversationItem {
  id: string;
  waId: string;
  contactName: string | null;
  lastMessageAt: string;
  lastInboundAt: string | null;
  lastPreview: string | null;
  unreadCount: number;
  /** True when free-form text can still be sent (customer messaged within 24h). */
  withinWindow: boolean;
}

export interface WhatsAppChatMessage {
  id: string;
  wamid: string | null;
  direction: 'inbound' | 'outbound';
  type: string;
  body: string;
  status: string | null;
  timestamp: string;
}

export interface WhatsAppConversationDetail {
  conversation: WhatsAppConversationItem;
  messages: WhatsAppChatMessage[];
}
