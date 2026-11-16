/** Org-level templates for agency → client WhatsApp messages. */
export interface WhatsAppAgencyNotify {
  reportTemplate: string | null;
  reportLanguage: string | null;
  approvalTemplate: string | null;
  approvalLanguage: string | null;
  paymentTemplate: string | null;
  paymentLanguage: string | null;
}

/** Per-client switches + phone for agency WhatsApp. */
export interface WhatsAppClientNotify {
  customerId: string;
  customerName: string;
  phone: string | null;
  reportEnabled: boolean;
  approvalEnabled: boolean;
  paymentEnabled: boolean;
}

export interface WhatsAppAdChatRow {
  adSourceId: string;
  adHeadline: string;
  chatsStarted: number;
  replies: number;
  leadsWon: number;
}
