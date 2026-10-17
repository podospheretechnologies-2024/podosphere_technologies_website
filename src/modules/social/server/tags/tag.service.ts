import 'server-only';
import type { SocialTag } from '@/generated/prisma/client';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import type { TagItem } from '../../types/settings';
import { tagRepository } from './tag.repository';
import type { SaveTagBody } from './tag.schema';

export function toTagItem(tag: Pick<SocialTag, 'id' | 'name' | 'color'>): TagItem {
  return { id: tag.id, name: tag.name, color: tag.color };
}

/** Single selected client → that id; 'all' → null (agency-shared). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

async function findOrThrow(scope: ClientScope, id: string) {
  const tag = await tagRepository.findById(scope, id);
  if (!tag) {
    throw new HttpError(404, 'Tag not found');
  }
  return tag;
}

async function assertUniqueName(
  organizationId: string,
  customerId: string | null,
  name: string,
  exceptId?: string
) {
  const existing = await tagRepository.findByName(organizationId, customerId, name);
  if (existing && existing.id !== exceptId) {
    throw new HttpError(409, `A tag named "${existing.name}" already exists`);
  }
}

export const tagService = {
  async list(scope: ClientScope): Promise<TagItem[]> {
    return (await tagRepository.list(scope)).map(toTagItem);
  },

  async create(scope: ClientScope, body: SaveTagBody): Promise<TagItem> {
    const customerId = customerIdForWrite(scope);
    await assertUniqueName(scope.organizationId, customerId, body.name);
    return toTagItem(await tagRepository.create(scope.organizationId, customerId, body));
  },

  async update(scope: ClientScope, id: string, body: SaveTagBody): Promise<TagItem> {
    const tag = await findOrThrow(scope, id);
    await assertUniqueName(scope.organizationId, tag.customerId, body.name, id);
    return toTagItem(await tagRepository.update(id, body));
  },

  // Soft delete: the tag disappears from posts but can be restored from the database.
  async remove(scope: ClientScope, id: string): Promise<void> {
    await findOrThrow(scope, id);
    await tagRepository.softDelete(id);
  },
};
