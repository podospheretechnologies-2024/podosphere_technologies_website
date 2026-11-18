import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { logAudit } from '@/shared/server/audit.service';
import { organizationScope } from '@/shared/server/client-scope';
import {
  BRAND_KIT_FIELDS,
  emptyBrandKit,
  type BrandKit,
} from '../../config/brand-kit';
import { brandKitSchema, brandKitService } from '../ai/brand-kit.service';
import { mediaService } from '../media/media.service';
import type { PortalSession } from '../approvals/approval.service';

const PORTAL_MEDIA_LIMIT = 48;

export type PortalBrandField = {
  key: string;
  label: string;
  placeholder: string;
  long: boolean;
  value: string;
};

export type PortalBrandMediaItem = {
  id: string;
  /** Original filename only — never the storage key. */
  name: string;
  /** Public / signed serve URL already stored on the row (path). */
  url: string;
  type: 'image' | 'video';
  thumbnailUrl: string | null;
};

export type PortalBrandDto = {
  fields: PortalBrandField[];
  media: PortalBrandMediaItem[];
};

function toPortalMedia(row: {
  id: string;
  originalName: string | null;
  path: string;
  type: string;
  thumbnail: string | null;
}): PortalBrandMediaItem {
  const name = row.originalName?.trim();
  return {
    id: row.id,
    name: name && name.length > 0 ? name : 'Untitled',
    url: row.path,
    type: row.type === 'VIDEO' ? 'video' : 'image',
    thumbnailUrl: row.thumbnail,
  };
}

export const portalBrandService = {
  async get(session: Pick<PortalSession, 'organizationId' | 'customerId'>): Promise<PortalBrandDto> {
    const scope = organizationScope(session.organizationId, session.customerId);
    const [kit, mediaRows] = await Promise.all([
      brandKitService.get(scope),
      // Direct SocialMedia query so isolation tests assert org + customer filters.
      prisma.socialMedia.findMany({
        where: {
          organizationId: session.organizationId,
          customerId: session.customerId,
          deletedAt: null,
          status: 'READY',
        },
        orderBy: { createdAt: 'desc' },
        take: PORTAL_MEDIA_LIMIT,
        select: {
          id: true,
          originalName: true,
          path: true,
          type: true,
          thumbnail: true,
        },
      }),
    ]);

    return {
      fields: BRAND_KIT_FIELDS.map((field) => ({
        key: field.key,
        label: field.label,
        placeholder: field.placeholder,
        long: field.long,
        value: kit[field.key] ?? '',
      })),
      media: mediaRows.map(toPortalMedia),
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
    session: Pick<PortalSession, 'approverId' | 'organizationId' | 'customerId'>,
    input: {
      fileName: string;
      body: ReadableStream<Uint8Array> | null;
      declaredSize?: number;
    }
  ): Promise<PortalBrandMediaItem> {
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

    const media = await mediaService.upload({
      scope,
      fileName: input.fileName,
      body: input.body,
      declaredSize: input.declaredSize,
      format: 'post',
    });

    await logAudit({
      action: 'portal.media_upload',
      targetType: 'social_media',
      targetId: media.id,
      metadata: {
        customerId: session.customerId,
        approverId: session.approverId,
        type: media.type,
        name: media.name,
      },
    });

    return {
      id: media.id,
      name: media.name,
      url: media.url,
      type: media.type,
      thumbnailUrl: media.thumbnail,
    };
  },
};
