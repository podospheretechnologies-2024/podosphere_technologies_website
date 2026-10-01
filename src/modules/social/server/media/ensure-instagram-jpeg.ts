import 'server-only';
import sharp from 'sharp';
import { getServerEnv } from '@/shared/lib/env';
import type { PublishMedia } from '../integrations/core/social-provider.interface';
import { getStorage } from '../storage/storage.factory';

const JPEG_MIME = 'image/jpeg';
const PNG_MIME = 'image/png';

/** Image types accepted for Facebook / Instagram posts (before Instagram convert). */
export const META_POST_IMAGE_MIME_TYPES = [JPEG_MIME, PNG_MIME] as const;

export function isMetaPostImageMime(mimeType: string): boolean {
  return mimeType === JPEG_MIME || mimeType === PNG_MIME || mimeType === 'image/jpg';
}

/**
 * Instagram Graph publishing expects JPEG image URLs. PNG (and odd jpg labels) are
 * converted and stored so Meta can download a public .jpg.
 */
export async function ensureInstagramPublishImage(media: PublishMedia): Promise<PublishMedia> {
  if (media.type !== 'image') {
    return media;
  }

  const mime = media.mimeType === 'image/jpg' ? JPEG_MIME : media.mimeType;
  if (mime === JPEG_MIME) {
    return { ...media, mimeType: JPEG_MIME };
  }

  if (mime !== PNG_MIME) {
    return media;
  }

  const jpegBuffer = await sharp(await media.read())
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const storage = getStorage();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(jpegBuffer));
      controller.close();
    },
  });
  const stored = await storage.save(stream, { extension: 'jpg', mimeType: JPEG_MIME });
  const url = new URL(stored.url, getServerEnv().APP_URL).toString();

  return {
    ...media,
    mimeType: JPEG_MIME,
    url,
    read: () => storage.read(stored.key),
  };
}
