import 'server-only';
import type { SocialHashtagGroup } from '@/generated/prisma/client';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import type { HashtagGroupItem } from '../../types/settings';
import { hashtagGroupRepository } from './hashtag-group.repository';
import type { SaveHashtagGroupBody } from './hashtag-group.schema';

/**
 * Turns free text ("#sale, summer  deals") into a clean, de-duplicated,
 * space-separated list of #hashtags, preserving the order they were entered.
 */
export function normalizeHashtags(input: string): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const bare = raw.replace(/^#+/, '').trim();
    if (!bare) continue;
    const key = bare.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(`#${bare}`);
  }
  return tags.join(' ');
}

export function toHashtagGroupItem(
  group: Pick<SocialHashtagGroup, 'id' | 'name' | 'hashtags'>
): HashtagGroupItem {
  return { id: group.id, name: group.name, hashtags: group.hashtags };
}

/** Single selected client → that id; 'all' → null (agency-shared). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

async function findOrThrow(scope: ClientScope, id: string) {
  const group = await hashtagGroupRepository.findById(scope, id);
  if (!group) {
    throw new HttpError(404, 'Hashtag group not found');
  }
  return group;
}

async function assertUniqueName(
  organizationId: string,
  customerId: string | null,
  name: string,
  exceptId?: string
) {
  const existing = await hashtagGroupRepository.findByName(organizationId, customerId, name);
  if (existing && existing.id !== exceptId) {
    throw new HttpError(409, `A hashtag group named "${existing.name}" already exists`);
  }
}

function prepare(body: SaveHashtagGroupBody): { name: string; hashtags: string } {
  const hashtags = normalizeHashtags(body.hashtags);
  if (!hashtags) {
    throw new HttpError(422, 'Add at least one hashtag');
  }
  return { name: body.name, hashtags };
}

export const hashtagGroupService = {
  async list(scope: ClientScope): Promise<HashtagGroupItem[]> {
    return (await hashtagGroupRepository.list(scope)).map(toHashtagGroupItem);
  },

  async create(scope: ClientScope, body: SaveHashtagGroupBody): Promise<HashtagGroupItem> {
    const customerId = customerIdForWrite(scope);
    const data = prepare(body);
    await assertUniqueName(scope.organizationId, customerId, data.name);
    return toHashtagGroupItem(
      await hashtagGroupRepository.create(scope.organizationId, customerId, data)
    );
  },

  async update(scope: ClientScope, id: string, body: SaveHashtagGroupBody): Promise<HashtagGroupItem> {
    const group = await findOrThrow(scope, id);
    const data = prepare(body);
    await assertUniqueName(scope.organizationId, group.customerId, data.name, id);
    return toHashtagGroupItem(await hashtagGroupRepository.update(id, data));
  },

  async remove(scope: ClientScope, id: string): Promise<void> {
    await findOrThrow(scope, id);
    await hashtagGroupRepository.softDelete(id);
  },
};
