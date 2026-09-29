import type { MediaFormat } from '../config/media';

export type MediaKind = 'image' | 'video';

export type { MediaFormat };

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: MediaKind;
  format: MediaFormat;
  mimeType: string | null;
  fileSize: number;
  thumbnail: string | null;
  alt: string | null;
  createdAt: string;
}

export interface MediaPage {
  page: number;
  pages: number;
  total: number;
  results: MediaItem[];
}
