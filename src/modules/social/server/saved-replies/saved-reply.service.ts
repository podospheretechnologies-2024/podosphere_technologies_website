import 'server-only';
import type { SocialSavedReply } from '@/generated/prisma/client';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { savedReplyRepository } from './saved-reply.repository';
import type { SaveSavedReplyBody } from './saved-reply.schema';

export interface SavedReplyItem {
  id: string;
  title: string;
  body: string;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toItem(row: SocialSavedReply): SavedReplyItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    customerId: row.customerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Single selected client → that id; 'all' → null (agency-shared). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

async function findOrThrow(scope: ClientScope, id: string) {
  const row = await savedReplyRepository.findById(scope, id);
  if (!row) throw new HttpError(404, 'Saved reply not found');
  return row;
}

export const savedReplyService = {
  async list(scope: ClientScope): Promise<SavedReplyItem[]> {
    return (await savedReplyRepository.list(scope)).map(toItem);
  },

  async create(scope: ClientScope, body: SaveSavedReplyBody): Promise<SavedReplyItem> {
    const customerId = customerIdForWrite(scope);
    return toItem(await savedReplyRepository.create(scope.organizationId, customerId, body));
  },

  async update(scope: ClientScope, id: string, body: SaveSavedReplyBody): Promise<SavedReplyItem> {
    await findOrThrow(scope, id);
    return toItem(await savedReplyRepository.update(id, body));
  },

  async remove(scope: ClientScope, id: string): Promise<void> {
    await findOrThrow(scope, id);
    await savedReplyRepository.softDelete(id);
  },
};
