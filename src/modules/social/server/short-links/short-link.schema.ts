import 'server-only';
import { z } from 'zod';
import {
  SHORT_LINK_DEFAULT_MEDIUM,
  SHORT_LINK_URL_MAX_LENGTH,
  SHORT_LINK_UTM_MAX_LENGTH,
} from '../../config/short-links';

const utmField = z
  .string()
  .trim()
  .max(SHORT_LINK_UTM_MAX_LENGTH, 'UTM value is too long')
  .optional();

export const createShortLinkSchema = z.object({
  targetUrl: z
    .string()
    .trim()
    .url('Enter a valid URL')
    .max(SHORT_LINK_URL_MAX_LENGTH, 'URL is too long'),
  utmSource: utmField,
  utmMedium: utmField.default(SHORT_LINK_DEFAULT_MEDIUM),
  utmCampaign: utmField,
  utmTerm: utmField,
  utmContent: utmField,
});

export type CreateShortLinkBody = z.infer<typeof createShortLinkSchema>;
