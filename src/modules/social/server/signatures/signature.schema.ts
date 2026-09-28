import 'server-only';
import { z } from 'zod';
import { SIGNATURE_MAX_LENGTH } from '../../config/settings';

export const saveSignatureSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write the signature text')
    .max(SIGNATURE_MAX_LENGTH, 'Signature is too long'),
  autoAdd: z.boolean().default(false),
});

export type SaveSignatureBody = z.infer<typeof saveSignatureSchema>;
