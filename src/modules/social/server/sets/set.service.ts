import 'server-only';
import type { Prisma, SocialSet } from '@/generated/prisma/client';
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

async function findOrThrow(organizationId: string, id: string) {
  const set = await setRepository.findById(organizationId, id);
  if (!set) {
    throw new HttpError(404, 'Template not found');
  }
  return set;
}

// Only references that still exist are stored, so a template never points at
// a deleted channel, tag or file.
async function buildContent(organizationId: string, body: CreateSetBody): Promise<TemplateContent> {
  const mediaIds = [...new Set(body.values.flatMap((value) => value.mediaIds))];
  const [integrations, tags, media] = await Promise.all([
    integrationRepository.findManyByIds(organizationId, body.integrationIds),
    tagRepository.findManyByIds(organizationId, body.tagIds),
    mediaIds.length ? mediaRepository.findManyByIds(organizationId, mediaIds) : [],
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
  async list(organizationId: string): Promise<TemplateItem[]> {
    return (await setRepository.list(organizationId)).map(toTemplateItem);
  },

  async create(organizationId: string, body: CreateSetBody): Promise<TemplateItem> {
    const content = await buildContent(organizationId, body);
    return toTemplateItem(
      await setRepository.create(
        organizationId,
        body.name,
        content as unknown as Prisma.InputJsonValue
      )
    );
  },

  async rename(organizationId: string, id: string, body: RenameSetBody): Promise<TemplateItem> {
    await findOrThrow(organizationId, id);
    return toTemplateItem(await setRepository.rename(id, body.name));
  },

  async remove(organizationId: string, id: string): Promise<void> {
    await findOrThrow(organizationId, id);
    await setRepository.delete(id);
  },
};
