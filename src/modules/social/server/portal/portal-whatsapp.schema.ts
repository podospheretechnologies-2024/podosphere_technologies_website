import 'server-only';
import { z } from 'zod';
import { WHATSAPP_PHONE_PATTERN, WHATSAPP_TEXT_MAX_LENGTH } from '../../config/whatsapp';

const recipient = z
  .string()
  .transform((value) => value.replace(/[\s()+-]/g, ''))
  .pipe(
    z
      .string()
      .regex(WHATSAPP_PHONE_PATTERN, 'Enter the number with country code, e.g. 919876543210')
  );

export const portalWhatsAppReplySchema = z.object({
  text: z.string().trim().min(1, 'Write a message').max(WHATSAPP_TEXT_MAX_LENGTH),
});

export const portalWhatsAppSendTemplateSchema = z.object({
  to: recipient,
  templateName: z.string().min(1, 'Pick a template'),
  language: z.string().min(2),
  variables: z
    .array(z.string().trim().min(1, 'Fill in every template variable'))
    .max(20)
    .default([]),
});

export const portalWhatsAppBroadcastSchema = z.object({
  name: z.string().trim().min(1, 'Name this broadcast').max(80),
  templateName: z.string().min(1, 'Pick a template'),
  language: z.string().min(2),
  phones: z
    .array(z.string())
    .min(1, 'Add at least one phone number')
    .max(200),
  variables: z
    .array(z.string().trim().min(1, 'Fill in every template variable'))
    .max(20)
    .default([]),
  consentAcknowledged: z.literal(true),
});

export const portalWhatsAppSummaryQuerySchema = z.object({
  days: z
    .enum(['7', '30'])
    .optional()
    .transform((value) => (value === '7' ? 7 : 30) as 7 | 30),
});

export type PortalWhatsAppReplyBody = z.infer<typeof portalWhatsAppReplySchema>;
export type PortalWhatsAppSendTemplateBody = z.infer<typeof portalWhatsAppSendTemplateSchema>;
export type PortalWhatsAppBroadcastBody = z.infer<typeof portalWhatsAppBroadcastSchema>;
