import type { PostSaveType } from '../config/posts';
import type { MediaFormat, MediaKind } from './media';
import type { TagItem } from './settings';

export type PostState = 'draft' | 'queue' | 'published' | 'error';

export interface PostMedia {
  id: string;
  url: string;
  type: MediaKind;
  format?: MediaFormat;
  alt: string | null;
}

export interface PostChannel {
  id: string;
  name: string;
  picture: string | null;
  providerIdentifier: string;
  providerName: string;
}

export interface PostListItem {
  id: string;
  group: string;
  state: PostState;
  publishDate: string;
  content: string;
  media: PostMedia[];
  commentsCount: number;
  releaseUrl: string | null;
  error: string | null;
  channel: PostChannel;
  tags: TagItem[];
}

export interface PostListPage {
  page: number;
  pages: number;
  total: number;
  results: PostListItem[];
}

export interface PostThreadItem {
  content: string;
  media: PostMedia[];
  delay: number;
}

export interface PostGroup {
  group: string;
  state: PostState;
  publishDate: string;
  tags: TagItem[];
  posts: { channel: PostChannel; values: PostThreadItem[] }[];
}

/** Request body for creating or updating a post group. */
export interface SavePostInput {
  type: PostSaveType;
  date: string;
  tagIds: string[];
  posts: {
    integrationId: string;
    values: { content: string; mediaIds: string[]; delay: number }[];
  }[];
}
