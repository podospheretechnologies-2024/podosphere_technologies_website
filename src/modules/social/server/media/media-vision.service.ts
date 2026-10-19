import 'server-only';
import OpenAI from 'openai';
import { z } from 'zod';
import { getServerEnv } from '@/shared/lib/env';
import type { ClientScope } from '@/shared/server/client-scope';
import { askClaude, isClaudeConfigured } from '../ai/claude.client';
import { prepareImageForVision } from './platform-resize';

const VisionResultSchema = z.object({
  alt: z.string(),
  captionIdeas: z.array(z.string()).min(1).max(5),
});

export type MediaVisionResult = z.infer<typeof VisionResultSchema>;

const OPENAI_VISION_MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 60_000;

/**
 * Feature flag soft-fail gate for F13 media-vision.
 * unset → on when Claude or OpenAI key exists; explicit false disables.
 */
export function isMediaVisionEnabled(): boolean {
  const flag = getServerEnv().MEDIA_VISION_ENABLED;
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return isClaudeConfigured() || Boolean(getServerEnv().OPENAI_API_KEY);
}

function cleanVisionResult(raw: MediaVisionResult): MediaVisionResult {
  const alt = raw.alt.trim().slice(0, 500);
  const captionIdeas = raw.captionIdeas
    .map((idea) => idea.trim())
    .filter(Boolean)
    .slice(0, 5);
  return { alt, captionIdeas };
}

async function analyzeWithClaude(
  scope: ClientScope,
  jpeg: Buffer
): Promise<MediaVisionResult> {
  return askClaude({
    scope,
    feature: 'media-vision',
    schema: VisionResultSchema,
    effort: 'low',
    images: [{ mimeType: 'image/jpeg', data: jpeg }],
    task: [
      'Look at the attached image from a social media upload.',
      'Write one concise accessibility alt text (1–2 sentences, no hashtags).',
      'Suggest 3 short caption ideas suitable for Instagram/Facebook (plain text, no markdown).',
      'Match the brand kit tone when it is set. Never invent brand facts.',
    ].join(' '),
    input: 'Describe this image for alt text and caption ideas.',
  });
}

async function analyzeWithOpenAI(jpeg: Buffer): Promise<MediaVisionResult> {
  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 1 });
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

  const completion = await client.chat.completions.create({
    model: OPENAI_VISION_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You write accessibility alt text and social caption ideas. Reply with JSON: {"alt":"...","captionIdeas":["...","...","..."]}.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Write one concise alt text and 3 caption ideas for this image. No markdown.',
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? '';
  const parsed = VisionResultSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error('OpenAI vision returned an unexpected shape');
  }
  return parsed.data;
}

/**
 * Optional vision pass on upload. Never throws: callers soft-fail and keep the upload.
 */
export async function analyzeUploadedImage(
  scope: ClientScope,
  imageBuffer: Buffer
): Promise<MediaVisionResult | null> {
  if (!isMediaVisionEnabled()) {
    return null;
  }

  try {
    const { buffer } = await prepareImageForVision(imageBuffer);
    const raw = isClaudeConfigured()
      ? await analyzeWithClaude(scope, buffer)
      : await analyzeWithOpenAI(buffer);
    const cleaned = cleanVisionResult(raw);
    if (!cleaned.alt || cleaned.captionIdeas.length === 0) {
      return null;
    }
    return cleaned;
  } catch (error) {
    console.warn('[media-vision] soft-fail', error instanceof Error ? error.message : error);
    return null;
  }
}
