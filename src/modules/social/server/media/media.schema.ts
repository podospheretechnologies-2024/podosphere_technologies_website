import 'server-only';
import { z } from 'zod';
import { DEFAULT_MEDIA_FORMAT, MEDIA_FORMATS } from '../../config/media';

export const listMediaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(200).optional(),
  format: z.enum(MEDIA_FORMATS).optional(),
});

export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;

export const uploadFileNameSchema = z
  .string()
  .trim()
  .min(1, 'File name is required')
  .max(255, 'File name is too long');

export const uploadFormatSchema = z
  .enum(MEDIA_FORMATS, 'Format must be post, reel or story')
  .default(DEFAULT_MEDIA_FORMAT);
