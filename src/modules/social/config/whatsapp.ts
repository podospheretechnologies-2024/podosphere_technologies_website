/** WhatsApp Cloud API limit for a text message body. */
export const WHATSAPP_TEXT_MAX_LENGTH = 4096;

/** Recipient in international format without "+", e.g. 919876543210. */
export const WHATSAPP_PHONE_PATTERN = /^\d{8,15}$/;

export const WHATSAPP_MESSAGE_TYPES = [
  { value: 'template', label: 'Template' },
  { value: 'text', label: 'Text' },
] as const;

export type WhatsAppMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number]['value'];
