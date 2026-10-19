import type {
  WhatsAppAutoReplyMatchType,
  WhatsAppAutoReplyReplyType,
} from '../config/whatsapp-auto-reply';

export interface WhatsAppAutoReplyItem {
  id: string;
  name: string;
  matchType: WhatsAppAutoReplyMatchType;
  pattern: string;
  caseSensitive: boolean;
  replyType: WhatsAppAutoReplyReplyType;
  replyText: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  templateVariables: string[];
  businessHoursEnabled: boolean;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  businessHoursTimezone: string | null;
  businessHoursDays: number[];
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SaveWhatsAppAutoReplyInput = Omit<
  WhatsAppAutoReplyItem,
  'id' | 'createdAt' | 'updatedAt'
>;
