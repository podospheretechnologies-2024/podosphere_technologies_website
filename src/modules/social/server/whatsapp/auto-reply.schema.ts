import 'server-only';
import { z } from 'zod';
import {
  WHATSAPP_AUTO_REPLY_MATCH_TYPES,
  WHATSAPP_AUTO_REPLY_NAME_MAX,
  WHATSAPP_AUTO_REPLY_PATTERN_MAX,
  WHATSAPP_AUTO_REPLY_REPLY_TYPES,
} from '../../config/whatsapp-auto-reply';
import { WHATSAPP_TEXT_MAX_LENGTH } from '../../config/whatsapp';

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:mm (24h)')
  .nullable()
  .optional();

export const saveWhatsAppAutoReplySchema = z
  .object({
    name: z.string().trim().min(1, 'Name the rule').max(WHATSAPP_AUTO_REPLY_NAME_MAX),
    matchType: z.enum(WHATSAPP_AUTO_REPLY_MATCH_TYPES),
    pattern: z.string().trim().min(1, 'Enter a keyword or pattern').max(WHATSAPP_AUTO_REPLY_PATTERN_MAX),
    caseSensitive: z.boolean().default(false),
    replyType: z.enum(WHATSAPP_AUTO_REPLY_REPLY_TYPES),
    replyText: z
      .string()
      .trim()
      .max(WHATSAPP_TEXT_MAX_LENGTH)
      .nullable()
      .optional(),
    templateName: z.string().trim().max(120).nullable().optional(),
    templateLanguage: z.string().trim().max(16).nullable().optional(),
    templateVariables: z.array(z.string().trim().max(300)).max(20).default([]),
    businessHoursEnabled: z.boolean().default(false),
    businessHoursStart: hhmm,
    businessHoursEnd: hhmm,
    businessHoursTimezone: z.string().trim().max(64).nullable().optional(),
    businessHoursDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    priority: z.number().int().min(0).max(10_000).default(100),
    active: z.boolean().default(true),
  })
  .superRefine((body, ctx) => {
    if (body.replyType === 'text') {
      if (!body.replyText?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Write the reply text', path: ['replyText'] });
      }
    } else {
      if (!body.templateName?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Pick a template', path: ['templateName'] });
      }
      if (!body.templateLanguage?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Pick a template language',
          path: ['templateLanguage'],
        });
      }
    }

    if (body.matchType === 'regex') {
      try {
        new RegExp(body.pattern);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid regular expression', path: ['pattern'] });
      }
    }

    if (body.businessHoursEnabled) {
      if (!body.businessHoursStart) {
        ctx.addIssue({
          code: 'custom',
          message: 'Set business-hours start',
          path: ['businessHoursStart'],
        });
      }
      if (!body.businessHoursEnd) {
        ctx.addIssue({
          code: 'custom',
          message: 'Set business-hours end',
          path: ['businessHoursEnd'],
        });
      }
    }
  });

export type SaveWhatsAppAutoReplyBody = z.infer<typeof saveWhatsAppAutoReplySchema>;
