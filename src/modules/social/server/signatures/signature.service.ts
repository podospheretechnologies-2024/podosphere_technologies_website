import 'server-only';
import type { SocialSignature } from '@/generated/prisma/client';
import type { ClientScope } from '@/shared/server/client-scope';
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

/** Single selected client → that id; 'all' → null (agency-shared). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

async function findOrThrow(scope: ClientScope, id: string) {
  const signature = await signatureRepository.findById(scope, id);
  if (!signature) {
    throw new HttpError(404, 'Signature not found');
  }
  return signature;
}

export const signatureService = {
  async list(scope: ClientScope): Promise<SignatureItem[]> {
    return (await signatureRepository.list(scope)).map(toSignatureItem);
  },

  async create(scope: ClientScope, body: SaveSignatureBody): Promise<SignatureItem> {
    const customerId = customerIdForWrite(scope);
    return toSignatureItem(await signatureRepository.create(scope.organizationId, customerId, body));
  },

  async update(scope: ClientScope, id: string, body: SaveSignatureBody): Promise<SignatureItem> {
    const signature = await findOrThrow(scope, id);
    return toSignatureItem(
      await signatureRepository.update(scope.organizationId, signature.customerId, id, body)
    );
  },

  async remove(scope: ClientScope, id: string): Promise<void> {
    await findOrThrow(scope, id);
    await signatureRepository.softDelete(id);
  },
};
