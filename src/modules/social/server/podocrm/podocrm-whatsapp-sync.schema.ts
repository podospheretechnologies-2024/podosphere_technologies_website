import { z } from 'zod';

export const podoCrmWhatsAppLinkSchema = z.object({
  code: z
    .string()
    .trim()
    .min(8)
    .max(64)
    .regex(/^PSL-[A-Za-z0-9]+-[A-Za-z0-9]+$/i, 'Paste a PodoCRM code like PSL-9R76E-PPAD2'),
});
