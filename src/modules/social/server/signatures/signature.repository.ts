import 'server-only';
import type { Prisma, SocialSignature } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

interface SignatureData {
  content: string;
  autoAdd: boolean;
}

// Only one signature can be added automatically per client (or agency-shared null),
// so switching it on for one switches it off for the others in the same transaction.
async function clearAutoAdd(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string | null
) {
  await tx.socialSignature.updateMany({
    where: { organizationId, customerId, autoAdd: true },
    data: { autoAdd: false },
  });
}

export const signatureRepository = {
  list(scope: ClientScope): Promise<SocialSignature[]> {
    return prisma.socialSignature.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById(scope: ClientScope, id: string): Promise<SocialSignature | null> {
    return prisma.socialSignature.findFirst({
      where: { id, ...scopeWhere(scope), deletedAt: null },
    });
  },

  create(
    organizationId: string,
    customerId: string | null,
    data: SignatureData
  ): Promise<SocialSignature> {
    return prisma.$transaction(async (tx) => {
      if (data.autoAdd) {
        await clearAutoAdd(tx, organizationId, customerId);
      }
      return tx.socialSignature.create({ data: { organizationId, customerId, ...data } });
    });
  },

  update(
    organizationId: string,
    customerId: string | null,
    id: string,
    data: SignatureData
  ): Promise<SocialSignature> {
    return prisma.$transaction(async (tx) => {
      if (data.autoAdd) {
        await clearAutoAdd(tx, organizationId, customerId);
      }
      return tx.socialSignature.update({ where: { id }, data });
    });
  },

  softDelete(id: string): Promise<SocialSignature> {
    return prisma.socialSignature.update({
      where: { id },
      data: { deletedAt: new Date(), autoAdd: false },
    });
  },
};
