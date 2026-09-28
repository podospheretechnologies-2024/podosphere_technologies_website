import 'server-only';
import type { SocialTag } from '@/generated/prisma/client';
import { HttpError } from '@/shared/server/http-error';
import type { TagItem } from '../../types/settings';
import { tagRepository } from './tag.repository';
import type { SaveTagBody } from './tag.schema';

export function toTagItem(tag: Pick<SocialTag, 'id' | 'name' | 'color'>): TagItem {
  return { id: tag.id, name: tag.name, color: tag.color };
}

async function findOrThrow(organizationId: string, id: string) {
  const tag = await tagRepository.findById(organizationId, id);
  if (!tag) {
    throw new HttpError(404, 'Tag not found');
  }
  return tag;
}

async function assertUniqueName(organizationId: string, name: string, exceptId?: string) {
  const existing = await tagRepository.findByName(organizationId, name);
  if (existing && existing.id !== exceptId) {
    throw new HttpError(409, `A tag named "${existing.name}" already exists`);
  }
}

export const tagService = {
  async list(organizationId: string): Promise<TagItem[]> {
    return (await tagRepository.list(organizationId)).map(toTagItem);
  },

  async create(organizationId: string, body: SaveTagBody): Promise<TagItem> {
    await assertUniqueName(organizationId, body.name);
    return toTagItem(await tagRepository.create(organizationId, body));
  },

  async update(organizationId: string, id: string, body: SaveTagBody): Promise<TagItem> {
    await findOrThrow(organizationId, id);
    await assertUniqueName(organizationId, body.name, id);
    return toTagItem(await tagRepository.update(id, body));
  },

  // Soft delete: the tag disappears from posts but can be restored from the database.
  async remove(organizationId: string, id: string): Promise<void> {
    await findOrThrow(organizationId, id);
    await tagRepository.softDelete(id);
  },
};
