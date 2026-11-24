/** Allow-list for "Posts published" (excludes stories, replies, comments). */
export const PUBLISHED_POST_TYPES = ['post', 'reel', 'video', 'carousel'] as const;

export type PublishedPostType = (typeof PUBLISHED_POST_TYPES)[number];

/**
 * SocialExternalPost.type values that count as a published post.
 * IG Graph media_type is stored lowercased (IMAGE → image, CAROUSEL_ALBUM → carousel_album).
 */
export const PUBLISHED_POST_TYPE_VALUES: string[] = [
  ...PUBLISHED_POST_TYPES,
  'image',
  'reels',
  'carousel_album',
];
