import 'server-only';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { getServerEnv } from '@/shared/lib/env';
import { resolveLocalFilePath } from './local.storage';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.mp4': 'video/mp4',
};

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) {
    return null;
  }

  let start: number;
  let end: number;
  if (!match[1]) {
    // "bytes=-500" means the last 500 bytes.
    start = Math.max(size - Number(match[2]), 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }

  return start <= end && start < size ? { start, end } : null;
}

// Stored files never change (every upload gets a new key), so they can be cached forever.
export async function createLocalFileResponse(
  key: string,
  rangeHeader: string | null
): Promise<Response> {
  const filePath = resolveLocalFilePath(getServerEnv().UPLOAD_DIRECTORY, key);
  if (!filePath) {
    return notFound();
  }

  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return notFound();
  }

  const headers = new Headers({
    'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });

  if (rangeHeader) {
    const range = parseRange(rangeHeader, fileStat.size);
    if (!range) {
      headers.set('Content-Range', `bytes */${fileStat.size}`);
      return new Response(null, { status: 416, headers });
    }

    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${fileStat.size}`);
    headers.set('Content-Length', String(range.end - range.start + 1));
    const stream = createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
  }

  headers.set('Content-Length', String(fileStat.size));
  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers });
}
