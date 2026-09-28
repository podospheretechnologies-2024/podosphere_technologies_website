import 'server-only';
import { z } from 'zod';

export const listMediaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(200).optional(),
});

export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;

export const uploadFileNameSchema = z
  .string()
  .trim()
  .min(1, 'File name is required')
  .max(255, 'File name is too long');
