import 'server-only';
import type { Prisma, SocialSet } from '@/generated/prisma/client';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import type { PostMedia } from '../../types/post';
import type { TemplateContent, TemplateItem } from '../../types/settings';
import { integrationRepository } from '../integrations/integration.repository';
import { mediaRepository } from '../media/media.repository';
import { tagRepository } from '../tags/tag.repository';
import { setRepository } from './set.repository';
import type { CreateSetBody, RenameSetBody } from './set.schema';

function readContent(value: Prisma.JsonValue): TemplateContent {
  const content = (value ?? {}) as Partial<TemplateContent>;
  return {
    integrationIds: content.integrationIds ?? [],
    tagIds: content.tagIds ?? [],
    values: content.values ?? [],
  };
}

function toTemplateItem(set: SocialSet): TemplateItem {
  return {
    id: set.id,
    name: set.name,
    content: readContent(set.content),
    createdAt: set.createdAt.toISOString(),
  };
}

/** Single selected client → that id; 'all' → null (agency-shared). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

async function findOrThrow(scope: ClientScope, id: string) {
  const set = await setRepository.findById(scope, id);
  if (!set) {
    throw new HttpError(404, 'Template not found');
  }
  return set;
}

// Only references that still exist are stored, so a template never points at
// a deleted channel, tag or file.
async function buildContent(scope: ClientScope, body: CreateSetBody): Promise<TemplateContent> {
  const mediaIds = [...new Set(body.values.flatMap((value) => value.mediaIds))];
  const [integrations, tags, media] = await Promise.all([
    integrationRepository.findManyByIds(scope.organizationId, body.integrationIds),
    tagRepository.findManyByIds(scope.organizationId, body.tagIds),
    mediaIds.length ? mediaRepository.findManyByIds(scope.organizationId, mediaIds) : [],
  ]);

  const mediaById = new Map<string, PostMedia>(
    media.map((item) => [
      item.id,
      {
        id: item.id,
        url: item.path,
        type: item.type === 'VIDEO' ? 'video' : 'image',
        alt: item.alt,
      },
    ])
  );

  return {
    integrationIds: integrations.map((integration) => integration.id),
    tagIds: tags.map((tag) => tag.id),
    values: body.values.map((value) => ({
      content: value.content,
      media: value.mediaIds.flatMap((id) => mediaById.get(id) ?? []),
    })),
  };
}

export const setService = {
  async list(scope: ClientScope): Promise<TemplateItem[]> {
    return (await setRepository.list(scope)).map(toTemplateItem);
  },

  async create(scope: ClientScope, body: CreateSetBody): Promise<TemplateItem> {
    const content = await buildContent(scope, body);
    return toTemplateItem(
      await setRepository.create(
        scope.organizationId,
        customerIdForWrite(scope),
        body.name,
        content as unknown as Prisma.InputJsonValue
      )
    );
  },

  async rename(scope: ClientScope, id: string, body: RenameSetBody): Promise<TemplateItem> {
    await findOrThrow(scope, id);
    return toTemplateItem(await setRepository.rename(id, body.name));
  },

  async remove(scope: ClientScope, id: string): Promise<void> {
    await findOrThrow(scope, id);
    await setRepository.delete(id);
  },
};
