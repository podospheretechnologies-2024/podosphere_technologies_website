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

export const sendWhatsAppSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    to: recipient,
    text: z.string().trim().min(1, 'Write a message').max(WHATSAPP_TEXT_MAX_LENGTH),
  }),
  z.object({
    type: z.literal('template'),
    to: recipient,
    templateName: z.string().min(1, 'Pick a template'),
    language: z.string().min(2),
    variables: z
      .array(z.string().trim().min(1, 'Fill in every template variable'))
      .max(20)
      .default([]),
  }),
]);
