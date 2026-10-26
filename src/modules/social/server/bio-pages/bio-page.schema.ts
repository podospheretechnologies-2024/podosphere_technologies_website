import 'server-only';
import { z } from 'zod';
import {
  BIO_LINK_LABEL_MAX_LENGTH,
  BIO_LINK_URL_MAX_LENGTH,
  BIO_PAGE_HEADLINE_MAX_LENGTH,
  BIO_PAGE_MAX_LINKS,
  BIO_PAGE_SLUG_MAX_LENGTH,
  BIO_PAGE_THEMES,
  BIO_PAGE_TITLE_MAX_LENGTH,
} from '../../config/settings';

const httpUrl = z
  .string()
  .trim()
  .min(1, 'Add a link URL')
  .max(BIO_LINK_URL_MAX_LENGTH, 'Link URL is too long')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Enter a valid http(s) URL');

const bioLinkSchema = z.object({
  id: z.string().optional(),
  label: z
    .string()
    .trim()
    .min(1, 'Name the button')
    .max(BIO_LINK_LABEL_MAX_LENGTH, 'Button label is too long'),
  url: httpUrl,
});

export const saveBioPageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only')
    .max(BIO_PAGE_SLUG_MAX_LENGTH, 'Link is too long')
    .optional(),
  title: z
    .string()
    .trim()
    .min(1, 'Add a title')
    .max(BIO_PAGE_TITLE_MAX_LENGTH, 'Title is too long'),
  headline: z
    .string()
    .trim()
    .max(BIO_PAGE_HEADLINE_MAX_LENGTH, 'Headline is too long')
    .nullish()
    .transform((value) => value || null),
  avatarUrl: httpUrl.nullish().transform((value) => value || null),
  theme: z.enum(BIO_PAGE_THEMES).default('light'),
  published: z.boolean().default(false),
  links: z.array(bioLinkSchema).max(BIO_PAGE_MAX_LINKS, 'Too many links').default([]),
});

export type SaveBioPageBody = z.infer<typeof saveBioPageSchema>;
export type SaveBioLinkBody = z.infer<typeof bioLinkSchema>;
