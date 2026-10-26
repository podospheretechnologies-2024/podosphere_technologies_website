import 'server-only';
import { randomUUID } from 'node:crypto';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { BIO_PAGE_SLUG_MAX_LENGTH } from '../../config/settings';
import type { BioPageItem, PublicBioPage } from '../../types/bio';
import { bioPageRepository, type BioPageWithLinks } from './bio-page.repository';
import type { SaveBioPageBody } from './bio-page.schema';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BIO_PAGE_SLUG_MAX_LENGTH);
  return base || `page-${randomUUID().slice(0, 8)}`;
}

function toItem(page: BioPageWithLinks): BioPageItem {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    headline: page.headline,
    avatarUrl: page.avatarUrl,
    theme: page.theme,
    published: page.published,
    views: page.views,
    links: page.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      clicks: link.clicks,
    })),
    createdAt: page.createdAt.toISOString(),
  };
}

/** Single selected client → that id; 'all' → null (agency-shared). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

async function uniqueSlug(desired: string, exceptId?: string): Promise<string> {
  let candidate = desired;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const taken = await bioPageRepository.slugTaken(candidate, exceptId);
    if (!taken) return candidate;
    const suffix = `-${randomUUID().slice(0, 4)}`;
    candidate = `${desired.slice(0, BIO_PAGE_SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
  }
  throw new HttpError(409, 'Could not find a free link; try a different one');
}

function pageScalars(body: SaveBioPageBody, slug: string) {
  return {
    slug,
    title: body.title,
    headline: body.headline ?? null,
    avatarUrl: body.avatarUrl ?? null,
    theme: body.theme,
    published: body.published,
  };
}

export const bioPageService = {
  async list(scope: ClientScope): Promise<BioPageItem[]> {
    return (await bioPageRepository.list(scope)).map(toItem);
  },

  async create(scope: ClientScope, body: SaveBioPageBody): Promise<BioPageItem> {
    const customerId = customerIdForWrite(scope);
    const slug = await uniqueSlug(body.slug?.trim() || slugify(body.title));
    const page = await bioPageRepository.create(
      scope.organizationId,
      customerId,
      pageScalars(body, slug),
      body.links
    );
    return toItem(page);
  },

  async update(scope: ClientScope, id: string, body: SaveBioPageBody): Promise<BioPageItem> {
    const existing = await bioPageRepository.findById(scope, id);
    if (!existing) {
      throw new HttpError(404, 'Link page not found');
    }
    const desired = body.slug?.trim() || existing.slug;
    const slug = desired === existing.slug ? existing.slug : await uniqueSlug(desired, id);
    const page = await bioPageRepository.save(id, pageScalars(body, slug), body.links);
    return toItem(page);
  },

  async remove(scope: ClientScope, id: string): Promise<void> {
    const existing = await bioPageRepository.findById(scope, id);
    if (!existing) {
      throw new HttpError(404, 'Link page not found');
    }
    await bioPageRepository.softDelete(id);
  },

  /** Public page content for /b/[slug], or null when there is no published page. */
  async getPublic(slug: string): Promise<{ id: string; page: PublicBioPage } | null> {
    const page = await bioPageRepository.findPublishedBySlug(slug);
    if (!page) return null;
    return {
      id: page.id,
      page: {
        title: page.title,
        headline: page.headline,
        avatarUrl: page.avatarUrl,
        theme: page.theme,
        links: page.links.map((link) => ({ id: link.id, label: link.label })),
      },
    };
  },

  recordView(id: string): Promise<unknown> {
    return bioPageRepository.incrementViews(id);
  },

  /** Returns the destination URL for a bio link, or null when it is not clickable. */
  async resolveRedirect(linkId: string): Promise<string | null> {
    const link = await bioPageRepository.findRedirectTarget(linkId);
    return link ? link.url : null;
  },

  recordClick(linkId: string): Promise<unknown> {
    return bioPageRepository.incrementClicks(linkId);
  },
};
