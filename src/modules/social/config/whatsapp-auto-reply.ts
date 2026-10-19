export const WHATSAPP_AUTO_REPLY_NAME_MAX = 120;
export const WHATSAPP_AUTO_REPLY_PATTERN_MAX = 500;
export const WHATSAPP_AUTO_REPLY_DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const WHATSAPP_AUTO_REPLY_MATCH_TYPES = ['keyword', 'regex'] as const;
export type WhatsAppAutoReplyMatchType = (typeof WHATSAPP_AUTO_REPLY_MATCH_TYPES)[number];

export const WHATSAPP_AUTO_REPLY_REPLY_TYPES = ['text', 'template'] as const;
export type WhatsAppAutoReplyReplyType = (typeof WHATSAPP_AUTO_REPLY_REPLY_TYPES)[number];

/** Weekdays for business-hours: 0 = Sunday … 6 = Saturday (JS Date.getDay). */
export const WHATSAPP_AUTO_REPLY_DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const;

export const WHATSAPP_AUTO_REPLY_SENDER_LABEL = 'Auto-reply';
