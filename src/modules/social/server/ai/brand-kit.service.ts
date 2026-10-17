import 'server-only';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import {
  BRAND_KIT_FIELD_MAX_LENGTH,
  BRAND_KIT_FIELDS,
  emptyBrandKit,
  type BrandKit,
  type BrandKitKey,
} from '../../config/brand-kit';

export const brandKitSchema = z.object(
  Object.fromEntries(
    BRAND_KIT_FIELDS.map((field) => [field.key, z.string().trim().max(BRAND_KIT_FIELD_MAX_LENGTH).default('')])
  ) as Record<BrandKitKey, z.ZodDefault<z.ZodString>>
);

/** Single selected client → that id; 'all' → null (agency brand kit). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

export const brandKitService = {
  async get(scope: ClientScope): Promise<BrandKit> {
    const row = await prisma.socialBrandKit.findFirst({
      where: scopeWhere(scope),
      orderBy: { updatedAt: 'desc' },
    });
    return { ...emptyBrandKit(), ...((row?.data ?? {}) as Partial<BrandKit>) };
  },

  async save(scope: ClientScope, data: BrandKit): Promise<BrandKit> {
    const customerId = customerIdForWrite(scope);
    const existing = await prisma.socialBrandKit.findFirst({
      where: { organizationId: scope.organizationId, customerId },
    });
    if (existing) {
      await prisma.socialBrandKit.update({ where: { id: existing.id }, data: { data } });
    } else {
      await prisma.socialBrandKit.create({
        data: { organizationId: scope.organizationId, customerId, data },
      });
    }
    return data;
  },
};
