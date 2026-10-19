import 'server-only';
import { z } from 'zod';
import { DEFAULT_MEDIA_FORMAT, MEDIA_FORMATS } from '../../config/media';
import { PLATFORM_IMAGE_SIZE_KEYS } from '../../config/platform-sizes';

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

export const mediaVariantQuerySchema = z.object({
  key: z.enum(PLATFORM_IMAGE_SIZE_KEYS),
  store: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type MediaVariantQuery = z.infer<typeof mediaVariantQuerySchema>;
