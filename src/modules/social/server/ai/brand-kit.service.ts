import 'server-only';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
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

export const brandKitService = {
  async get(organizationId: string): Promise<BrandKit> {
    const row = await prisma.socialBrandKit.findUnique({ where: { organizationId } });
    return { ...emptyBrandKit(), ...((row?.data ?? {}) as Partial<BrandKit>) };
  },

  async save(organizationId: string, data: BrandKit): Promise<BrandKit> {
    await prisma.socialBrandKit.upsert({
      where: { organizationId },
      create: { organizationId, data },
      update: { data },
    });
    return data;
  },
};
