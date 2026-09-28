import 'server-only';
import type { Prisma, SocialSignature } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';

interface SignatureData {
  content: string;
  autoAdd: boolean;
}

// Only one signature can be added automatically, so switching it on for one
// switches it off for the others in the same transaction.
async function clearAutoAdd(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.socialSignature.updateMany({
    where: { organizationId, autoAdd: true },
    data: { autoAdd: false },
  });
}

export const signatureRepository = {
  list(organizationId: string): Promise<SocialSignature[]> {
    return prisma.socialSignature.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById(organizationId: string, id: string): Promise<SocialSignature | null> {
    return prisma.socialSignature.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  create(organizationId: string, data: SignatureData): Promise<SocialSignature> {
    return prisma.$transaction(async (tx) => {
      if (data.autoAdd) {
        await clearAutoAdd(tx, organizationId);
      }
      return tx.socialSignature.create({ data: { organizationId, ...data } });
    });
  },

  update(organizationId: string, id: string, data: SignatureData): Promise<SocialSignature> {
    return prisma.$transaction(async (tx) => {
      if (data.autoAdd) {
        await clearAutoAdd(tx, organizationId);
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
