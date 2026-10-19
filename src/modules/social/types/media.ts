import type { MediaFormat } from '../config/media';
import type { PlatformImageSizeKey } from '../config/platform-sizes';

export type MediaKind = 'image' | 'video';

export type { MediaFormat, PlatformImageSizeKey };

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: MediaKind;
  format: MediaFormat;
  mimeType: string | null;
  fileSize: number;
  width: number | null;
  height: number | null;
  thumbnail: string | null;
  alt: string | null;
  /** Vision caption suggestions from upload (null when vision soft-failed / skipped). */
  captionIdeas: string[] | null;
  /** URL of the one stored platform crop, if generated. */
  variantUrl: string | null;
  variantKey: PlatformImageSizeKey | null;
  createdAt: string;
}

export interface MediaPage {
  page: number;
  pages: number;
  total: number;
  results: MediaItem[];
}

export interface MediaVariantResponse {
  key: PlatformImageSizeKey;
  url: string;
  width: number;
  height: number;
  /** True when this is the row's stored variant (not a one-off transform). */
  stored: boolean;
}
