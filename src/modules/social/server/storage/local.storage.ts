import 'server-only';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { SaveFileOptions, StorageProvider, StoredFile } from './storage.interface';

export const LOCAL_FILES_ROUTE = '/api/social/media/files';

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

// Maps a storage key to an absolute path, refusing anything that could escape
// the upload directory.
export function resolveLocalFilePath(uploadDirectory: string, key: string): string | null {
  const segments = key.split('/');
  if (segments.some((segment) => !SAFE_SEGMENT.test(segment) || segment.startsWith('.'))) {
    return null;
  }

  const root = path.resolve(uploadDirectory);
  const filePath = path.resolve(root, ...segments);
  return filePath.startsWith(root + path.sep) ? filePath : null;
}

export class LocalStorage implements StorageProvider {
  constructor(private readonly uploadDirectory: string) {}

  async save(body: ReadableStream<Uint8Array>, options: SaveFileOptions): Promise<StoredFile> {
    const now = new Date();
    const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const key = `${folder}/${randomUUID()}.${options.extension}`;
    const filePath = resolveLocalFilePath(this.uploadDirectory, key);
    if (!filePath) {
      throw new Error(`Invalid storage key: ${key}`);
    }

    await mkdir(path.dirname(filePath), { recursive: true });

    try {
      await pipeline(
        Readable.fromWeb(body as NodeReadableStream<Uint8Array>),
        createWriteStream(filePath)
      );
    } catch (error) {
      await rm(filePath, { force: true });
      throw error;
    }

    return { key, url: `${LOCAL_FILES_ROUTE}/${key}` };
  }

  async read(key: string): Promise<Buffer> {
    const filePath = resolveLocalFilePath(this.uploadDirectory, key);
    if (!filePath) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    // Uploads are runtime data, not part of the build output.
    return readFile(/* turbopackIgnore: true */ filePath);
  }

  async remove(key: string): Promise<void> {
    const filePath = resolveLocalFilePath(this.uploadDirectory, key);
    if (filePath) {
      await rm(filePath, { force: true });
    }
  }
}
