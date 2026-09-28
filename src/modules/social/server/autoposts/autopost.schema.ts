import 'server-only';
import { z } from 'zod';
import { AUTOPOST_TEMPLATE_MAX_LENGTH, AUTOPOST_TITLE_MAX_LENGTH } from '../../config/automation';

export const saveAutopostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Name the feed')
    .max(AUTOPOST_TITLE_MAX_LENGTH, 'Name is too long'),
  url: z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) feed URL' }),
  content: z
    .string()
    .trim()
    .max(AUTOPOST_TEMPLATE_MAX_LENGTH, 'Template is too long')
    .nullable()
    .default(null)
    .transform((value) => value || null),
  integrationIds: z.array(z.string().min(1)).min(1, 'Select at least one channel').max(50),
  onSlot: z.boolean().default(true),
  syncLast: z.boolean().default(false),
  addPicture: z.boolean().default(false),
  generateContent: z.boolean().default(false),
  active: z.boolean().default(true),
});

export type SaveAutopostBody = z.infer<typeof saveAutopostSchema>;
