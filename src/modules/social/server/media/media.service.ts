import 'server-only';
import type { Prisma, SocialMedia, SocialMediaFormat } from '@/generated/prisma/client';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import {
  DEFAULT_MEDIA_FORMAT,
  getMediaMaxSize,
  MEDIA_FORMAT_VIDEO_ONLY,
  MEDIA_PAGE_SIZE,
  type MediaFormat,
} from '../../config/media';
import {
  defaultVariantKeyForFormat,
  PLATFORM_IMAGE_SIZES,
  PLATFORM_IMAGE_SIZE_KEYS,
  type PlatformImageSizeKey,
} from '../../config/platform-sizes';
import type { MediaItem, MediaPage, MediaVariantResponse } from '../../types/media';
import { getStorage } from '../storage/storage.factory';
import { detectFileType, FILE_SIGNATURE_LENGTH } from './detect-file-type';
import { analyzeUploadedImage } from './media-vision.service';
import { mediaRepository } from './media.repository';
import type { ListMediaQuery } from './media.schema';
import {
  bufferToReadableStream,
  readImageDimensions,
  resizeToPlatformSize,
} from './platform-resize';

interface UploadMediaInput {
  scope: ClientScope;
  fileName: string;
  body: ReadableStream<Uint8Array> | null;
  declaredSize?: number;
  format?: MediaFormat;
}

const formatToDb: Record<MediaFormat, SocialMediaFormat> = {
  post: 'POST',
  reel: 'REEL',
  story: 'STORY',
};

const formatFromDb: Record<SocialMediaFormat, MediaFormat> = {
  POST: 'post',
  REEL: 'reel',
  STORY: 'story',
};

/** Single selected client → that id; 'all' → null (agency-shared media). */
function customerIdForWrite(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

function readCaptionIdeas(value: Prisma.JsonValue | null | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  const ideas = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
  );
  return ideas.length ? ideas : null;
}

function readVariantKey(value: string | null | undefined): PlatformImageSizeKey | null {
  if (!value) return null;
  return (PLATFORM_IMAGE_SIZE_KEYS as readonly string[]).includes(value)
    ? (value as PlatformImageSizeKey)
    : null;
}

function toMediaItem(media: SocialMedia): MediaItem {
  return {
    id: media.id,
    name: media.originalName ?? media.name,
    url: media.path,
    type: media.type === 'VIDEO' ? 'video' : 'image',
    format: formatFromDb[media.format],
    mimeType: media.mimeType,
    fileSize: media.fileSize,
    width: media.width,
    height: media.height,
    thumbnail: media.thumbnail,
    alt: media.alt,
    captionIdeas: readCaptionIdeas(media.captionIdeas),
    variantUrl: media.variantPath,
    variantKey: readVariantKey(media.variantKey),
    createdAt: media.createdAt.toISOString(),
  };
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// Reads just enough of the stream to sniff the file type, keeping the chunks
// so they can be replayed into storage.
async function readHead(reader: ReadableStreamDefaultReader<Uint8Array>, length: number) {
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < length) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }

  const bytes = new Uint8Array(Math.min(total, length));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= bytes.length) {
      break;
    }
    const slice = chunk.subarray(0, bytes.length - offset);
    bytes.set(slice, offset);
    offset += slice.byteLength;
  }

  return { bytes, chunks };
}

async function readStreamToBuffer(
  headChunks: Uint8Array[],
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxSize: number
): Promise<Buffer> {
  const parts: Buffer[] = headChunks.map((chunk) => Buffer.from(chunk));
  let size = parts.reduce((sum, part) => sum + part.byteLength, 0);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxSize) {
      await reader.cancel();
      throw new HttpError(413, `File is too large. The limit is ${formatMegabytes(maxSize)}.`);
    }
    parts.push(Buffer.from(value));
  }

  return Buffer.concat(parts);
}

async function enrichImageUpload(
  scope: ClientScope,
  media: SocialMedia,
  storedKey: string,
  format: MediaFormat
): Promise<SocialMedia> {
  const storage = getStorage();
  let buffer: Buffer;
  try {
    buffer = await storage.read(storedKey);
  } catch (error) {
    console.warn('[media] could not read uploaded file for enrich', error);
    return media;
  }

  const patch: Prisma.SocialMediaUncheckedUpdateInput = {};
  const dims = await readImageDimensions(buffer);
  if (dims) {
    patch.width = dims.width;
    patch.height = dims.height;
  }

  // One stored platform crop (helper remains available for other sizes on demand).
  try {
    const variantKey = defaultVariantKeyForFormat(format);
    const resized = await resizeToPlatformSize(buffer, variantKey);
    const storedVariant = await storage.save(bufferToReadableStream(resized.buffer), {
      extension: resized.extension,
      mimeType: resized.mimeType,
    });
    patch.variantPath = storedVariant.url;
    patch.variantKey = resized.key;
  } catch (error) {
    console.warn('[media] variant resize soft-fail', error instanceof Error ? error.message : error);
  }

  const vision = await analyzeUploadedImage(scope, buffer);
  if (vision) {
    patch.alt = vision.alt;
    patch.captionIdeas = vision.captionIdeas;
  }

  if (Object.keys(patch).length === 0) {
    return media;
  }
  return mediaRepository.update(media.id, patch);
}

export const mediaService = {
  async list(scope: ClientScope, query: ListMediaQuery): Promise<MediaPage> {
    const { total, results } = await mediaRepository.list({
      scope,
      page: query.page,
      search: query.search || undefined,
      format: query.format ? formatToDb[query.format] : undefined,
    });

    return {
      page: query.page,
      pages: Math.ceil(total / MEDIA_PAGE_SIZE),
      total,
      results: results.map(toMediaItem),
    };
  },

  async upload({
    scope,
    fileName,
    body,
    declaredSize,
    format = DEFAULT_MEDIA_FORMAT,
  }: UploadMediaInput): Promise<MediaItem> {
    if (!body) {
      throw new HttpError(400, 'No file was uploaded');
    }

    const reader = body.getReader();
    const head = await readHead(reader, FILE_SIGNATURE_LENGTH);
    const detected = detectFileType(head.bytes);

    if (!detected) {
      await reader.cancel();
      throw new HttpError(
        415,
        'Unsupported file type. Upload JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF images or MP4 videos.'
      );
    }

    const isVideo = detected.mimeType.startsWith('video/');
    if (MEDIA_FORMAT_VIDEO_ONLY[format] && !isVideo) {
      await reader.cancel();
      throw new HttpError(415, 'Reels must be MP4 videos.');
    }

    const maxSize = getMediaMaxSize(detected.mimeType);
    const tooLarge = () =>
      new HttpError(413, `File is too large. The limit is ${formatMegabytes(maxSize)}.`);

    if (declaredSize && declaredSize > maxSize) {
      await reader.cancel();
      throw tooLarge();
    }

    // Images: buffer so we can enrich (vision + one variant). Videos: stream to storage.
    if (!isVideo) {
      const buffer = await readStreamToBuffer(head.chunks, reader, maxSize);
      const stored = await getStorage().save(bufferToReadableStream(buffer), detected);

      let media = await mediaRepository.create({
        organizationId: scope.organizationId,
        customerId: customerIdForWrite(scope),
        name: stored.key,
        originalName: fileName,
        path: stored.url,
        type: 'IMAGE',
        format: formatToDb[format],
        mimeType: detected.mimeType,
        fileSize: buffer.byteLength,
        status: 'READY',
      });

      media = await enrichImageUpload(scope, media, stored.key, format);
      return toMediaItem(media);
    }

    let size = 0;
    const limitedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of head.chunks) {
          size += chunk.byteLength;
          controller.enqueue(chunk);
        }
        if (size > maxSize) {
          controller.error(tooLarge());
        }
      },
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        size += value.byteLength;
        if (size > maxSize) {
          await reader.cancel();
          controller.error(tooLarge());
          return;
        }
        controller.enqueue(value);
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });

    const stored = await getStorage().save(limitedBody, detected);

    const media = await mediaRepository.create({
      organizationId: scope.organizationId,
      // null only for agency-shared media when scope is 'all'
      customerId: customerIdForWrite(scope),
      name: stored.key,
      originalName: fileName,
      path: stored.url,
      type: 'VIDEO',
      format: formatToDb[format],
      mimeType: detected.mimeType,
      fileSize: size,
      status: 'READY',
    });

    return toMediaItem(media);
  },

  /**
   * On-demand platform crop using the shared sharp helper.
   * If `key` matches the stored variant, returns that URL; otherwise transforms without replacing
   * the stored one (unless `store` is true).
   */
  async getPlatformVariant(
    scope: ClientScope,
    id: string,
    key: PlatformImageSizeKey,
    store = false
  ): Promise<MediaVariantResponse> {
    const media = await mediaRepository.findById(scope, id);
    if (!media) {
      throw new HttpError(404, 'Media not found');
    }
    if (media.type !== 'IMAGE') {
      throw new HttpError(400, 'Platform variants are only available for images');
    }

    if (media.variantKey === key && media.variantPath) {
      const size = PLATFORM_IMAGE_SIZES[key];
      return {
        key,
        url: media.variantPath,
        width: size.width,
        height: size.height,
        stored: true,
      };
    }

    const storage = getStorage();
    const buffer = await storage.read(media.name);
    const resized = await resizeToPlatformSize(buffer, key);
    const storedVariant = await storage.save(bufferToReadableStream(resized.buffer), {
      extension: resized.extension,
      mimeType: resized.mimeType,
    });

    if (store || !media.variantPath) {
      await mediaRepository.update(media.id, {
        variantPath: storedVariant.url,
        variantKey: resized.key,
      });
      return {
        key: resized.key,
        url: storedVariant.url,
        width: resized.width,
        height: resized.height,
        stored: true,
      };
    }

    return {
      key: resized.key,
      url: storedVariant.url,
      width: resized.width,
      height: resized.height,
      stored: false,
    };
  },

  /** Fetch a remote http(s) image/video and save it into the media library. */
  async uploadFromUrl(
    scope: ClientScope,
    sourceUrl: string,
    format: MediaFormat = DEFAULT_MEDIA_FORMAT
  ): Promise<MediaItem> {
    let url: URL;
    try {
      url = new URL(sourceUrl);
    } catch {
      throw new HttpError(400, `Invalid media URL: ${sourceUrl}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new HttpError(400, `Media URL must be http(s): ${sourceUrl}`);
    }

    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1'
    ) {
      throw new HttpError(400, `Media URL host is not allowed: ${url.hostname}`);
    }

    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: { Accept: 'image/*,video/mp4,*/*' },
    }).catch(() => {
      throw new HttpError(400, `Could not download media: ${sourceUrl}`);
    });

    if (!response.ok || !response.body) {
      throw new HttpError(400, `Could not download media (${response.status}): ${sourceUrl}`);
    }

    const pathName = url.pathname.split('/').pop() || 'media';
    const fileName = pathName.slice(0, 180) || 'media';
    const declaredSize = Number(response.headers.get('content-length')) || undefined;

    return this.upload({
      scope,
      fileName,
      body: response.body,
      declaredSize,
      format,
    });
  },

  // Soft delete only: scheduled posts may still reference the file.
  async remove(scope: ClientScope, id: string): Promise<void> {
    const media = await mediaRepository.findById(scope, id);
    if (!media) {
      throw new HttpError(404, 'Media not found');
    }
    await mediaRepository.softDelete(media.id);
  },
};
