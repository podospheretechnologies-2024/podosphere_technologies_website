import type { PostSaveType, RecurrenceRule } from '../config/posts';
import type { MediaFormat, MediaKind } from './media';
import type { TagItem } from './settings';

export interface PostRecurrence {
  rule: RecurrenceRule;
  until: string | null;
  maxRuns: number | null;
  evergreen: boolean;
  runCount: number;
}

export type PostState = 'draft' | 'queue' | 'published' | 'error';

/** Multi-step approval; null/undefined when the post is not in review. */
export type ApprovalStep = 'INTERNAL' | 'CLIENT' | 'APPROVED' | 'REJECTED';

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
  approvalStep: ApprovalStep | null;
  customerId: string | null;
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
  recurrence: PostRecurrence | null;
  posts: { channel: PostChannel; firstComment: string | null; values: PostThreadItem[] }[];
}

/** Request body for creating or updating a post group. */
export interface SavePostInput {
  type: PostSaveType;
  date: string;
  tagIds: string[];
  /** null clears an existing recurrence; omit is treated as null from the composer. */
  recurrence?: {
    rule: RecurrenceRule;
    until?: string | null;
    maxRuns?: number | null;
    evergreen?: boolean;
  } | null;
  posts: {
    integrationId: string;
    firstComment?: string;
    values: { content: string; mediaIds: string[]; delay: number }[];
  }[];
}
