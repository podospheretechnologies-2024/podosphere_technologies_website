import type { Prisma } from '@/generated/prisma/client';

/** One public media item captured from Instagram business_discovery. */
export interface CompetitorMediaItem {
  id: string;
  caption: string | null;
  likeCount: number;
  commentsCount: number;
  mediaType: string;
  permalink: string | null;
  timestamp: string;
  thumbnailUrl: string | null;
}

const MEDIA_TYPES = new Set(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REELS']);

export function engagementScore(item: Pick<CompetitorMediaItem, 'likeCount' | 'commentsCount'>): number {
  return item.likeCount + item.commentsCount;
}

export function parseCompetitorMedia(value: Prisma.JsonValue | null | undefined): CompetitorMediaItem[] {
  if (!Array.isArray(value)) return [];
  const items: CompetitorMediaItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : null;
    if (!id) continue;
    const mediaType = typeof row.mediaType === 'string' ? row.mediaType : 'IMAGE';
    items.push({
      id,
      caption: typeof row.caption === 'string' ? row.caption : null,
      likeCount: Number(row.likeCount) || 0,
      commentsCount: Number(row.commentsCount) || 0,
      mediaType: MEDIA_TYPES.has(mediaType) ? mediaType : mediaType || 'IMAGE',
      permalink: typeof row.permalink === 'string' ? row.permalink : null,
      timestamp: typeof row.timestamp === 'string' ? row.timestamp : '',
      thumbnailUrl: typeof row.thumbnailUrl === 'string' ? row.thumbnailUrl : null,
    });
  }
  return items;
}

export function competitorMediaToJson(items: CompetitorMediaItem[]): Prisma.InputJsonValue {
  return items as unknown as Prisma.InputJsonValue;
}

/** Posts published in the current calendar month (UTC), ranked by likes + comments. */
export function topPostsThisMonth(
  items: CompetitorMediaItem[],
  limit = 5,
  now = new Date()
): CompetitorMediaItem[] {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return items
    .filter((item) => {
      if (!item.timestamp) return false;
      const at = new Date(item.timestamp);
      return !Number.isNaN(at.getTime()) && at >= monthStart && at <= now;
    })
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, limit);
}

/** Average engagement rate across recent media: mean((likes+comments)/followers). */
export function averageEngagementRate(
  items: CompetitorMediaItem[],
  followers: number
): number | null {
  if (followers <= 0 || items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + engagementScore(item) / followers, 0);
  return Math.round((total / items.length) * 10000) / 100; // percent, 2 dp
}
