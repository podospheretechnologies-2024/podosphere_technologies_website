export type MediaKind = 'image' | 'video';

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: MediaKind;
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
