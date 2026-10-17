import 'server-only';

export interface SaveFileOptions {
  extension: string;
  mimeType: string;
}

export interface StoredFile {
  // Identifier used to remove the file later.
  key: string;
  // URL the file is served from (relative for local storage, absolute for cloud storage).
  url: string;
}

export interface StorageProvider {
  save(body: ReadableStream<Uint8Array>, options: SaveFileOptions): Promise<StoredFile>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
