import 'server-only';
import type { SocialMedia, SocialMediaFormat } from '@/generated/prisma/client';
import { HttpError } from '@/shared/server/http-error';
import {
  DEFAULT_MEDIA_FORMAT,
  getMediaMaxSize,
  MEDIA_FORMAT_VIDEO_ONLY,
  MEDIA_PAGE_SIZE,
  type MediaFormat,
} from '../../config/media';
import type { MediaItem, MediaPage } from '../../types/media';
import { getStorage } from '../storage/storage.factory';
import { detectFileType, FILE_SIGNATURE_LENGTH } from './detect-file-type';
import { mediaRepository } from './media.repository';
import type { ListMediaQuery } from './media.schema';

interface UploadMediaInput {
  organizationId: string;
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

function toMediaItem(media: SocialMedia): MediaItem {
  return {
    id: media.id,
    name: media.originalName ?? media.name,
    url: media.path,
    type: media.type === 'VIDEO' ? 'video' : 'image',
    format: formatFromDb[media.format],
    mimeType: media.mimeType,
    fileSize: media.fileSize,
    thumbnail: media.thumbnail,
    alt: media.alt,
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

export const mediaService = {
  async list(organizationId: string, query: ListMediaQuery): Promise<MediaPage> {
    const { total, results } = await mediaRepository.list({
      organizationId,
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
    organizationId,
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
      organizationId,
      name: stored.key,
      originalName: fileName,
      path: stored.url,
      type: isVideo ? 'VIDEO' : 'IMAGE',
      format: formatToDb[format],
      mimeType: detected.mimeType,
      fileSize: size,
      status: 'READY',
    });

    return toMediaItem(media);
  },

  // Soft delete only: scheduled posts may still reference the file.
  async remove(organizationId: string, id: string): Promise<void> {
    const media = await mediaRepository.findById(organizationId, id);
    if (!media) {
      throw new HttpError(404, 'Media not found');
    }
    await mediaRepository.softDelete(media.id);
  },
};
