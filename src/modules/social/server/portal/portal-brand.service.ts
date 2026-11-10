import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { organizationScope } from '@/shared/server/client-scope';
import {
  BRAND_KIT_FIELDS,
  emptyBrandKit,
  type BrandKit,
} from '../../config/brand-kit';
import { brandKitSchema, brandKitService } from '../ai/brand-kit.service';
import { mediaService } from '../media/media.service';
import type { PortalSession } from '../approvals/approval.service';

export type PortalBrandField = {
  key: string;
  label: string;
  placeholder: string;
  long: boolean;
  value: string;
};

export type PortalBrandMediaItem = {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
};

export type PortalBrandDto = {
  fields: PortalBrandField[];
  media: PortalBrandMediaItem[];
};

export const portalBrandService = {
  async get(session: Pick<PortalSession, 'organizationId' | 'customerId'>): Promise<PortalBrandDto> {
    const scope = organizationScope(session.organizationId, session.customerId);
    const [kit, mediaPage] = await Promise.all([
      brandKitService.get(scope),
      mediaService.list(scope, { page: 1 }),
    ]);

    return {
      fields: BRAND_KIT_FIELDS.map((field) => ({
        key: field.key,
        label: field.label,
        placeholder: field.placeholder,
        long: field.long,
        value: kit[field.key] ?? '',
      })),
      media: mediaPage.results
        .filter((item) => item.type === 'image')
        .slice(0, 24)
        .map((item) => ({
          id: item.id,
          name: item.name,
          url: item.url,
          type: item.type,
        })),
    };
  },

  async save(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    raw: Record<string, string>
  ): Promise<PortalBrandDto> {
    const scope = organizationScope(session.organizationId, session.customerId);
    const parsed = brandKitSchema.parse({ ...emptyBrandKit(), ...raw }) as BrandKit;
    await brandKitService.save(scope, parsed);
    return this.get(session);
  },

  async uploadMedia(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    input: {
      fileName: string;
      body: ReadableStream<Uint8Array> | null;
      declaredSize?: number;
    }
  ) {
    const scope = organizationScope(session.organizationId, session.customerId);
    // Confirm client still exists before writing media into their library.
    const customer = await prisma.socialCustomer.findFirst({
      where: {
        id: session.customerId,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!customer) {
      const { HttpError } = await import('@/shared/server/http-error');
      throw new HttpError(404, 'Client not found');
    }

    return mediaService.upload({
      scope,
      fileName: input.fileName,
      body: input.body,
      declaredSize: input.declaredSize,
      format: 'post',
    });
  },
};
