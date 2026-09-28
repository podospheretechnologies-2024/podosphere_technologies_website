import 'server-only';
import type { MediaMimeType } from '../../config/media';

export interface DetectedFileType {
  mimeType: MediaMimeType;
  extension: string;
}

// Bytes needed to recognise every supported format.
export const FILE_SIGNATURE_LENGTH = 16;

const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'dash',
  'M4V ',
  'mmp4',
  'MSNV',
]);

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

// Reads the real type from the first bytes instead of trusting the file name
// or the Content-Type sent by the browser.
export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (startsWith(bytes, [0x42, 0x4d])) {
    return { mimeType: 'image/bmp', extension: 'bmp' };
  }
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { mimeType: 'image/tiff', extension: 'tiff' };
  }
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (brand === 'avif' || brand === 'avis') {
      return { mimeType: 'image/avif', extension: 'avif' };
    }
    if (MP4_BRANDS.has(brand)) {
      return { mimeType: 'video/mp4', extension: 'mp4' };
    }
  }
  return null;
}
