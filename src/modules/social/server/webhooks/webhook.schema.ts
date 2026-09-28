import 'server-only';
import { z } from 'zod';
import { WEBHOOK_NAME_MAX_LENGTH } from '../../config/automation';

export const saveWebhookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the webhook')
    .max(WEBHOOK_NAME_MAX_LENGTH, 'Webhook name is too long'),
  url: z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) URL' }),
  integrationIds: z.array(z.string().min(1)).min(1, 'Select at least one channel').max(50),
});

export type SaveWebhookBody = z.infer<typeof saveWebhookSchema>;
