import 'server-only';
import sharp from 'sharp';
import {
  PLATFORM_IMAGE_SIZES,
  type PlatformImageSizeKey,
} from '../../config/platform-sizes';

const VISION_MAX_EDGE = 1568;
const VISION_JPEG_QUALITY = 85;
const VARIANT_JPEG_QUALITY = 90;

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface PlatformResizeResult {
  buffer: Buffer;
  mimeType: 'image/jpeg';
  extension: 'jpg';
  width: number;
  height: number;
  key: PlatformImageSizeKey;
}

/** Read width/height without mutating pixels. */
export async function readImageDimensions(input: Buffer): Promise<ImageDimensions | null> {
  try {
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return null;
    return { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/**
 * Cover-crop to a platform size. Shared helper for the one stored upload variant
 * and on-demand transforms.
 */
export async function resizeToPlatformSize(
  input: Buffer,
  key: PlatformImageSizeKey
): Promise<PlatformResizeResult> {
  const target = PLATFORM_IMAGE_SIZES[key];
  const buffer = await sharp(input)
    .rotate()
    .resize(target.width, target.height, {
      fit: 'cover',
      position: 'attention',
    })
    .jpeg({ quality: VARIANT_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return {
    buffer,
    mimeType: 'image/jpeg',
    extension: 'jpg',
    width: target.width,
    height: target.height,
    key,
  };
}

/** Downscale for vision APIs (Claude / OpenAI) while keeping usable detail. */
export async function prepareImageForVision(input: Buffer): Promise<{
  buffer: Buffer;
  mimeType: 'image/jpeg';
}> {
  const buffer = await sharp(input)
    .rotate()
    .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return { buffer, mimeType: 'image/jpeg' };
}

export function bufferToReadableStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}
