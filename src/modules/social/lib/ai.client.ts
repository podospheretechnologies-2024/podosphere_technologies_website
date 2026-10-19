import { apiFetch } from '@/shared/lib/fetcher';
import type { AiImageOrientation, AiPostFormat } from '../config/ai';
import type { ImagePlatformSize, ImageStyle } from '../config/image-presets';
import { AI_API_ROUTE } from '../hooks/use-ai-status';
import type { CaptionTonePresetId } from '../server/ai/presets';
import type { AiPostVariations, AiThread } from '../types/ai';
import type { MediaItem } from '../types/media';

function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(`${AI_API_ROUTE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function generatePosts(input: {
  content: string;
  format: AiPostFormat;
  maxLength?: number;
  tonePresetId?: CaptionTonePresetId;
}): Promise<AiPostVariations> {
  return postJson('posts', input);
}

export function generatePostsFromUrl(input: {
  url: string;
  format: AiPostFormat;
  maxLength?: number;
  tonePresetId?: CaptionTonePresetId;
}): Promise<AiPostVariations> {
  return postJson('url-posts', input);
}

export function splitIntoThread(input: { content: string; maxLength: number }): Promise<AiThread> {
  return postJson('thread', input);
}

export function generateImage(input: {
  prompt: string;
  orientation?: AiImageOrientation;
  platformSize?: ImagePlatformSize;
  style?: ImageStyle;
  count?: number;
}): Promise<MediaItem[]> {
  return postJson('image', input);
}
