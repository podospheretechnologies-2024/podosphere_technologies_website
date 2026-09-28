import 'server-only';
import OpenAI from 'openai';
import { z } from 'zod';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { AI_POST_VARIATIONS, type AiImageOrientation, type AiPostFormat } from '../../config/ai';
import { POST_MAX_THREAD_ITEMS } from '../../config/posts';
import type { AiPostVariations, AiStatus, AiThread } from '../../types/ai';
import type { MediaItem } from '../../types/media';
import { mediaService } from '../media/media.service';
import type {
  GenerateImageBody,
  GeneratePostsBody,
  SplitThreadBody,
  UrlPostsBody,
} from './ai.schema';
import { askClaude, isClaudeConfigured } from './claude.client';
import { fetchWebPage } from './web-page';

// Text (posts, threads, image prompts) is written by Claude (claude.client.ts).
// Claude doesn't generate images, so the image itself still comes from OpenAI when a key is set.
const IMAGE_REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
const SHRINK_ATTEMPTS = 2;

const IMAGE_SIZES: Record<AiImageOrientation, '1024x1024' | '1024x1536' | '1536x1024'> = {
  square: '1024x1024',
  portrait: '1024x1536',
  landscape: '1536x1024',
};

const VariationsFormat = z.object({
  variations: z.array(z.object({ posts: z.array(z.string()) })),
});
const ThreadFormat = z.object({ posts: z.array(z.string()) });
const ShrinkFormat = z.object({ post: z.string() });
const ImagePromptFormat = z.object({ prompt: z.string() });

let imageClient: OpenAI | undefined;

function getImageClient(): OpenAI {
  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'Image generation needs OPENAI_API_KEY in .env (Claude writes text only).');
  }
  imageClient ??= new OpenAI({ apiKey, timeout: IMAGE_REQUEST_TIMEOUT_MS, maxRetries: 1 });
  return imageClient;
}

function toImageHttpError(error: unknown): unknown {
  if (!(error instanceof OpenAI.APIError)) {
    return error;
  }
  if (error.status === 401) {
    return new HttpError(503, 'The OpenAI API key is invalid');
  }
  if (error.status === 429) {
    return new HttpError(429, 'The image service is busy or its quota is used up. Try again later.');
  }
  if (error.status === 400) {
    return new HttpError(400, error.message);
  }
  return new HttpError(502, 'The image service is not available right now. Try again.');
}

function cleanPosts(posts: string[]): string[] {
  return posts
    .map((post) => post.trim())
    .filter(Boolean)
    .slice(0, POST_MAX_THREAD_ITEMS);
}

function lengthRule(maxLength: number | undefined): string {
  return maxLength ? `Every post must be at most ${maxLength} characters long.` : '';
}

async function writeVariations(
  organizationId: string,
  source: string,
  format: AiPostFormat,
  maxLength: number | undefined,
  extraRules: string[] = []
): Promise<string[][]> {
  const shape =
    format === 'thread'
      ? 'Each variation is a thread of 2 to 6 posts that read well in order; the first post must make people want to read on.'
      : 'Each variation is a single post, so its posts array has exactly one element.';

  const { variations } = await askClaude({
    organizationId,
    feature: format === 'thread' ? 'thread-variations' : 'post-variations',
    schema: VariationsFormat,
    task: [
      `Write ${AI_POST_VARIATIONS} clearly different social media post variations based on the input.`,
      shape,
      lengthRule(maxLength),
      'Write in the language of the input.',
      ...extraRules,
    ]
      .filter(Boolean)
      .join('\n'),
    input: source,
  });

  return variations.map((variation) => cleanPosts(variation.posts)).filter((posts) => posts.length);
}

// Asks the AI to shorten a post that is still over the limit; gives the post
// back unchanged if it does not manage (the composer shows the overflow).
async function shrink(organizationId: string, post: string, maxLength: number): Promise<string> {
  for (let attempt = 0; attempt < SHRINK_ATTEMPTS && post.length > maxLength; attempt++) {
    const { post: shorter } = await askClaude({
      organizationId,
      feature: 'shrink',
      schema: ShrinkFormat,
      task: `Shorten the social media post in the input to at most ${maxLength} characters. Keep the meaning, the tone and the line breaks; remove words rather than rewriting.`,
      input: post,
      effort: 'low',
    });
    if (shorter.trim()) {
      post = shorter.trim();
    }
  }
  return post;
}

export const aiService = {
  status(): AiStatus {
    return { configured: isClaudeConfigured(), imageConfigured: Boolean(getServerEnv().OPENAI_API_KEY) };
  },

  async generatePosts(organizationId: string, body: GeneratePostsBody): Promise<AiPostVariations> {
    return {
      variations: await writeVariations(organizationId, body.content, body.format, body.maxLength),
      source: null,
    };
  },

  async generatePostsFromUrl(organizationId: string, body: UrlPostsBody): Promise<AiPostVariations> {
    if (!isClaudeConfigured()) {
      // fail before loading the page when AI is switched off
      throw new HttpError(503, 'AI is not configured. Set ANTHROPIC_API_KEY in .env.');
    }
    const page = await fetchWebPage(body.url);
    const source = [page.title ? `Title: ${page.title}` : '', page.text]
      .filter(Boolean)
      .join('\n\n');

    return {
      variations: await writeVariations(organizationId, `<web_page>\n${source}\n</web_page>`, body.format, body.maxLength, [
        'The input is the text of a web page. Write about its main article only and ignore menus, ads and cookie notices.',
        `End the first post of every variation with this link: ${page.url}`,
      ]),
      source: { url: page.url, title: page.title },
    };
  },

  async splitThread(organizationId: string, body: SplitThreadBody): Promise<AiThread> {
    const { posts } = await askClaude({
      organizationId,
      feature: 'split-thread',
      schema: ThreadFormat,
      task: [
        'Split the social media post in the input into a thread.',
        lengthRule(body.maxLength),
        'Keep the original wording and line breaks. Split between paragraphs or sentences, never inside a sentence unless one sentence alone is over the limit.',
        'Do not add numbering, hashtags, emojis or any new content.',
      ].join('\n'),
      input: body.content,
      effort: 'low',
    });

    const cleaned = cleanPosts(posts);
    if (cleaned.length === 0) {
      throw new HttpError(502, 'The AI did not return a usable answer. Try again.');
    }
    return {
      posts: await Promise.all(cleaned.map((post) => shrink(organizationId, post, body.maxLength))),
    };
  },

  // The idea is first expanded into a detailed prompt (Claude), then the image is generated
  // (OpenAI) and saved to the media library like an upload so it can be attached to posts.
  async generateImage(organizationId: string, body: GenerateImageBody): Promise<MediaItem> {
    const images = getImageClient(); // fail early when image generation is switched off
    const { prompt } = await askClaude({
      organizationId,
      feature: 'image-prompt',
      schema: ImagePromptFormat,
      task: [
        'Turn the idea in the input into a detailed prompt for an image generator.',
        'Describe the subject, composition, style, lighting and colours; for realistic images also describe the camera and lens.',
        'Do not ask for any text inside the image unless the input explicitly wants it.',
      ].join('\n'),
      input: body.prompt,
      effort: 'low',
    });

    let base64: string | undefined;
    try {
      const result = await images.images.generate({
        model: getServerEnv().OPENAI_IMAGE_MODEL,
        prompt,
        size: IMAGE_SIZES[body.orientation],
        n: 1,
      });
      base64 = result.data?.[0]?.b64_json;
    } catch (error) {
      throw toImageHttpError(error);
    }
    if (!base64) {
      throw new HttpError(502, 'The AI did not return an image. Try again.');
    }

    const bytes = Buffer.from(base64, 'base64');
    return mediaService.upload({
      organizationId,
      fileName: `ai-image-${Date.now()}.png`,
      body: new Blob([new Uint8Array(bytes)]).stream(),
      declaredSize: bytes.byteLength,
    });
  },
};
