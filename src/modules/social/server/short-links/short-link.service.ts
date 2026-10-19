import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SocialShortLink } from '@/generated/prisma/client';
import { getServerEnv } from '@/shared/lib/env';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import {
  SHORT_LINK_CODE_BYTES,
  SHORT_LINK_CODE_MAX_ATTEMPTS,
} from '../../config/short-links';
import type { ShortLinkItem } from '../../types/short-link';
import { shortLinkRepository } from './short-link.repository';
import type { CreateShortLinkBody } from './short-link.schema';

function optionalUtm(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Append stored UTM params onto the target URL (existing query keys win). */
export function buildDestinationUrl(link: {
  targetUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}): string {
  const url = new URL(link.targetUrl);
  const pairs: Array<[string, string | null]> = [
    ['utm_source', link.utmSource],
    ['utm_medium', link.utmMedium],
    ['utm_campaign', link.utmCampaign],
    ['utm_term', link.utmTerm],
    ['utm_content', link.utmContent],
  ];
  for (const [key, value] of pairs) {
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function shortUrlFor(code: string): string {
  return new URL(`/l/${code}`, getServerEnv().APP_URL).toString();
}

function toItem(link: SocialShortLink): ShortLinkItem {
  return {
    id: link.id,
    code: link.code,
    shortUrl: shortUrlFor(link.code),
    targetUrl: link.targetUrl,
    destinationUrl: buildDestinationUrl(link),
    utmSource: link.utmSource,
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    utmTerm: link.utmTerm,
    utmContent: link.utmContent,
    clicks: link.clicks,
    customerId: link.customerId,
    createdAt: link.createdAt.toISOString(),
  };
}

/** Single selected client → that id; 'all' → null (agency-shared). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

function generateCode(): string {
  return randomBytes(SHORT_LINK_CODE_BYTES).toString('base64url');
}

export const shortLinkService = {
  async list(scope: ClientScope): Promise<ShortLinkItem[]> {
    return (await shortLinkRepository.list(scope)).map(toItem);
  },

  async create(scope: ClientScope, body: CreateShortLinkBody): Promise<ShortLinkItem> {
    const customerId = customerIdForWrite(scope);
    const payload = {
      targetUrl: body.targetUrl,
      utmSource: optionalUtm(body.utmSource),
      utmMedium: optionalUtm(body.utmMedium),
      utmCampaign: optionalUtm(body.utmCampaign),
      utmTerm: optionalUtm(body.utmTerm),
      utmContent: optionalUtm(body.utmContent),
    };

    for (let attempt = 0; attempt < SHORT_LINK_CODE_MAX_ATTEMPTS; attempt++) {
      const code = generateCode();
      try {
        return toItem(await shortLinkRepository.create(scope.organizationId, customerId, { code, ...payload }));
      } catch (error) {
        const isUnique =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === 'P2002';
        if (!isUnique || attempt === SHORT_LINK_CODE_MAX_ATTEMPTS - 1) {
          throw error;
        }
      }
    }

    throw new HttpError(500, 'Could not create short link');
  },

  /** Public lookup for /l/[code]. */
  async resolveByCode(code: string): Promise<SocialShortLink | null> {
    return shortLinkRepository.findByCode(code);
  },

  async recordClick(id: string): Promise<void> {
    await shortLinkRepository.incrementClicks(id);
  },
};
