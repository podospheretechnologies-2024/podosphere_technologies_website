import 'server-only';
import type { SocialSignature } from '@/generated/prisma/client';
import { HttpError } from '@/shared/server/http-error';
import type { SignatureItem } from '../../types/settings';
import { signatureRepository } from './signature.repository';
import type { SaveSignatureBody } from './signature.schema';

function toSignatureItem(signature: SocialSignature): SignatureItem {
  return {
    id: signature.id,
    content: signature.content,
    autoAdd: signature.autoAdd,
    createdAt: signature.createdAt.toISOString(),
  };
}

async function findOrThrow(organizationId: string, id: string) {
  const signature = await signatureRepository.findById(organizationId, id);
  if (!signature) {
    throw new HttpError(404, 'Signature not found');
  }
  return signature;
}

export const signatureService = {
  async list(organizationId: string): Promise<SignatureItem[]> {
    return (await signatureRepository.list(organizationId)).map(toSignatureItem);
  },

  async create(organizationId: string, body: SaveSignatureBody): Promise<SignatureItem> {
    return toSignatureItem(await signatureRepository.create(organizationId, body));
  },

  async update(
    organizationId: string,
    id: string,
    body: SaveSignatureBody
  ): Promise<SignatureItem> {
    await findOrThrow(organizationId, id);
    return toSignatureItem(await signatureRepository.update(organizationId, id, body));
  },

  async remove(organizationId: string, id: string): Promise<void> {
    await findOrThrow(organizationId, id);
    await signatureRepository.softDelete(id);
  },
};
