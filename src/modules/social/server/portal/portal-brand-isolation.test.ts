import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/server/audit.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../ai/brand-kit.service', () => ({
  brandKitSchema: { parse: (value: unknown) => value },
  brandKitService: {
    get: vi.fn().mockResolvedValue({ brand_name: 'Acme' }),
    save: vi.fn().mockResolvedValue({ brand_name: 'Acme' }),
  },
}));
vi.mock('../media/media.service', () => ({
  mediaService: {
    upload: vi.fn().mockResolvedValue({
      id: 'm-new',
      name: 'product.jpg',
      url: '/media/product.jpg',
      type: 'image',
      thumbnail: null,
    }),
  },
}));
vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    socialCustomer: {
      findFirst: vi.fn().mockResolvedValue({ id: 'client-a' }),
    },
    socialMedia: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'm-img',
          originalName: 'logo.png',
          path: '/media/logo.png',
          type: 'IMAGE',
          thumbnail: null,
        },
        {
          id: 'm-vid',
          originalName: 'reel.mp4',
          path: '/media/reel.mp4',
          type: 'VIDEO',
          thumbnail: '/media/reel-thumb.jpg',
        },
      ]),
    },
  },
}));

import { logAudit } from '@/shared/server/audit.service';
import { prisma } from '@/shared/lib/prisma';
import { brandKitService } from '../ai/brand-kit.service';
import { mediaService } from '../media/media.service';
import { portalBrandService } from './portal-brand.service';

const SESSION = {
  approverId: 'apr-a',
  organizationId: 'org-a',
  customerId: 'client-a',
};

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal brand / media tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists SocialMedia only for session org + customer', async () => {
    const dto = await portalBrandService.get(SESSION);
    expect(brandKitService.get).toHaveBeenCalledWith({
      organizationId: 'org-a',
      customerIds: ['client-a'],
    });
    expect(whereOf(db.socialMedia.findMany)).toMatchObject({
      organizationId: 'org-a',
      customerId: 'client-a',
      deletedAt: null,
      status: 'READY',
    });
    expect(dto.media).toEqual([
      {
        id: 'm-img',
        name: 'logo.png',
        url: '/media/logo.png',
        type: 'image',
        thumbnailUrl: null,
      },
      {
        id: 'm-vid',
        name: 'reel.mp4',
        url: '/media/reel.mp4',
        type: 'video',
        thumbnailUrl: '/media/reel-thumb.jpg',
      },
    ]);
  });

  it('client A media never leaks to client B', async () => {
    db.socialMedia.findMany
      .mockResolvedValueOnce([
        {
          id: 'media-a',
          originalName: 'logo-a.png',
          path: '/api/social/media/files/a.png',
          type: 'IMAGE',
          thumbnail: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'media-b',
          originalName: 'logo-b.png',
          path: '/api/social/media/files/b.png',
          type: 'IMAGE',
          thumbnail: null,
        },
      ]);

    const a = await portalBrandService.get({
      organizationId: 'org-a',
      customerId: 'client-a',
    });
    const b = await portalBrandService.get({
      organizationId: 'org-a',
      customerId: 'client-b',
    });

    expect(a.media.map((row) => row.id)).toEqual(['media-a']);
    expect(b.media.map((row) => row.id)).toEqual(['media-b']);
    expect(a.media.some((row) => row.id === 'media-b')).toBe(false);
    expect(b.media.some((row) => row.id === 'media-a')).toBe(false);
    expect(db.socialMedia.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'org-a', customerId: 'client-a' },
    });
    expect(db.socialMedia.findMany.mock.calls[1]?.[0]).toMatchObject({
      where: { organizationId: 'org-a', customerId: 'client-b' },
    });
  });

  it('never returns storage keys as filenames', async () => {
    db.socialMedia.findMany.mockResolvedValueOnce([
      {
        id: 'media-raw',
        originalName: null,
        path: '/api/social/media/files/raw-key.mp4',
        type: 'VIDEO',
        thumbnail: '/api/social/media/files/raw-key-thumb.jpg',
      },
    ]);
    const dto = await portalBrandService.get(SESSION);
    expect(dto.media[0]).toMatchObject({
      name: 'Untitled',
      url: '/api/social/media/files/raw-key.mp4',
      type: 'video',
      thumbnailUrl: '/api/social/media/files/raw-key-thumb.jpg',
    });
    expect(JSON.stringify(dto)).not.toMatch(/accessToken|secret|storageKey/);
  });

  it('saves brand kit only through the session client scope', async () => {
    await portalBrandService.save(SESSION, { brand_name: 'Acme' });
    expect(brandKitService.save).toHaveBeenCalledWith(
      { organizationId: 'org-a', customerIds: ['client-a'] },
      expect.objectContaining({ brand_name: 'Acme' })
    );
  });

  it('uploads into the session customer library and audits with approverId', async () => {
    const body = new ReadableStream<Uint8Array>();
    const item = await portalBrandService.uploadMedia(SESSION, {
      fileName: 'product.jpg',
      body,
    });

    expect(mediaService.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { organizationId: 'org-a', customerIds: ['client-a'] },
        fileName: 'product.jpg',
        body,
        format: 'post',
      })
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'portal.media_upload',
        targetType: 'social_media',
        targetId: 'm-new',
        metadata: expect.objectContaining({
          customerId: 'client-a',
          approverId: 'apr-a',
        }),
      })
    );
    expect(item).toEqual({
      id: 'm-new',
      name: 'product.jpg',
      url: '/media/product.jpg',
      type: 'image',
      thumbnailUrl: null,
    });
  });

  it('refuses upload when the session client is missing', async () => {
    db.socialCustomer.findFirst.mockResolvedValueOnce(null);
    await expect(
      portalBrandService.uploadMedia(SESSION, { fileName: 'x.jpg', body: null })
    ).rejects.toMatchObject({ status: 404 });
    expect(mediaService.upload).not.toHaveBeenCalled();
  });
});
