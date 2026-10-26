import 'server-only';
import OpenAI from 'openai';
import { z } from 'zod';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import {
  AI_POST_VARIATIONS,
  AI_REEL_PLATFORM_LABELS,
  type AiImageOrientation,
  type AiPostFormat,
  type AiReelPlatform,
} from '../../config/ai';
import type { BrandKit } from '../../config/brand-kit';
import {
  imagePlatformSizePreset,
  imageStylePreset,
  type ImagePlatformSize,
  type ImageStyle,
} from '../../config/image-presets';
import { POST_MAX_THREAD_ITEMS } from '../../config/posts';
import type {
  AiCompetitorResult,
  AiPostVariations,
  AiReelScript,
  AiStatus,
  AiThread,
} from '../../types/ai';
import type { MediaItem } from '../../types/media';
import { mediaService } from '../media/media.service';
import type {
  CompetitorContentBody,
  GenerateImageBody,
  GeneratePostsBody,
  GenerateReelBody,
  SplitThreadBody,
  UrlPostsBody,
} from './ai.schema';
import { brandKitService } from './brand-kit.service';
import { askClaude } from './claude.client';
import { aiSettingsService } from './ai-settings.service';
import { geminiGenerateImage } from './providers/gemini-image';
import { captionTonePromptRule } from './presets';
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

function resolveOrientation(body: GenerateImageBody): AiImageOrientation {
  const platform = imagePlatformSizePreset(body.platformSize);
  return platform?.orientation ?? body.orientation;
}

function brandVisualNotes(kit: BrandKit): string[] {
  const notes: string[] = [];
  const colours = kit.brand_colours?.trim();
  const visual = kit.visual_style?.trim();
  if (colours) {
    notes.push(`Use these brand colours in the palette: ${colours}.`);
  }
  if (visual) {
    notes.push(`Match this visual style: ${visual}.`);
  }
  return notes;
}

function composeImageIdea(
  prompt: string,
  style: ImageStyle | undefined,
  platformSize: ImagePlatformSize | undefined,
  brandNotes: string[]
): string {
  const styleHint = imageStylePreset(style)?.promptHint;
  const sizeHint = imagePlatformSizePreset(platformSize)?.aspectHint;
  return [
    prompt.trim(),
    styleHint ? `Style: ${styleHint}` : '',
    sizeHint ? `Frame for ${sizeHint}.` : '',
    ...brandNotes,
  ]
    .filter(Boolean)
    .join('\n');
}

function localImagePrompt(idea: string): string {
  return [
    idea,
    'Detailed social-media image: clear subject, intentional composition and lighting.',
    'Do not render any text, logos, watermarks or UI chrome inside the image unless the idea explicitly asks for text.',
  ].join('\n');
}

const VariationsFormat = z.object({
  variations: z.array(z.object({ posts: z.array(z.string()) })),
});
const ThreadFormat = z.object({ posts: z.array(z.string()) });
const ShrinkFormat = z.object({ post: z.string() });
const ImagePromptFormat = z.object({ prompt: z.string() });

const ReelFormat = z.object({
  concept: z.string(),
  hook: z.string(),
  scenes: z.array(
    z.object({
      timecode: z.string(),
      visual: z.string(),
      onScreenText: z.string(),
    })
  ),
  voiceover: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  audioIdea: z.string(),
  cta: z.string(),
});
const CompetitorPostFormat = VariationsFormat.extend({ analysis: z.string() });
const CompetitorReelFormat = z.object({ analysis: z.string(), reel: ReelFormat });

function cleanHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/^#+/, '').replace(/\s+/g, '');
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(`#${tag}`);
  }
  return cleaned.slice(0, 20);
}

function normalizeReel(reel: z.infer<typeof ReelFormat>): AiReelScript {
  return {
    concept: reel.concept.trim(),
    hook: reel.hook.trim(),
    scenes: reel.scenes
      .map((scene) => ({
        timecode: scene.timecode.trim(),
        visual: scene.visual.trim(),
        onScreenText: scene.onScreenText.trim(),
      }))
      .filter((scene) => scene.visual || scene.onScreenText),
    voiceover: reel.voiceover.trim(),
    caption: reel.caption.trim(),
    hashtags: cleanHashtags(reel.hashtags),
    audioIdea: reel.audioIdea.trim(),
    cta: reel.cta.trim(),
  };
}

function reelTask(platform: AiReelPlatform, lengthSeconds: number, toneRule: string | null): string {
  return [
    `Write a short-form video (Reel) script for ${AI_REEL_PLATFORM_LABELS[platform]}, about ${lengthSeconds} seconds long.`,
    'Return all of these fields:',
    '- concept: one line summarising the idea.',
    '- hook: a scroll-stopping opening line for the first ~2 seconds.',
    '- scenes: an ordered shot list; each scene has a timecode (e.g. "0–3s"), a visual (what to film or show) and short on-screen text (a few words). Size the scenes so they fit the total length.',
    '- voiceover: what to say out loud (or the narration), matching the length.',
    '- caption: a ready-to-post caption for the feed.',
    '- hashtags: 8–15 relevant hashtags, no spaces inside a tag.',
    '- audioIdea: describe the vibe of trending audio to use; do not name specific copyrighted tracks.',
    '- cta: a clear call to action.',
    'Write in the language of the input.',
    toneRule,
  ]
    .filter(Boolean)
    .join('\n');
}

type ImageSize = (typeof IMAGE_SIZES)[AiImageOrientation];
type ImageProviderConfig = { apiKey: string; model: string };

/** gpt-image bills per image; one call with `n`, falling back to a single clearer image on 400. */
async function generateOpenAiImages(
  cfg: ImageProviderConfig,
  prompt: string,
  size: ImageSize,
  requested: number
): Promise<string[]> {
  const client = new OpenAI({ apiKey: cfg.apiKey, timeout: IMAGE_REQUEST_TIMEOUT_MS, maxRetries: 1 });
  try {
    const result = await client.images.generate({ model: cfg.model, prompt, size, n: requested });
    return (result.data ?? [])
      .map((item) => item.b64_json)
      .filter((value): value is string => Boolean(value));
  } catch (error) {
    if (requested > 1 && error instanceof OpenAI.APIError && error.status === 400) {
      try {
        const fallback = await client.images.generate({ model: cfg.model, prompt, size, n: 1 });
        const only = fallback.data?.[0]?.b64_json;
        return only ? [only] : [];
      } catch (fallbackError) {
        throw toImageHttpError(fallbackError);
      }
    }
    throw toImageHttpError(error);
  }
}

/** Gemini returns one image per call, so we fan out for the requested count. */
async function generateGeminiImages(
  cfg: ImageProviderConfig,
  prompt: string,
  requested: number
): Promise<string[]> {
  const results = await Promise.all(
    Array.from({ length: requested }, () =>
      geminiGenerateImage({ apiKey: cfg.apiKey, model: cfg.model, prompt })
    )
  );
  return results.filter((image): image is { base64: string; mimeType: string } => image !== null).map((image) => image.base64);
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
  scope: ClientScope,
  source: string,
  format: AiPostFormat,
  maxLength: number | undefined,
  extraRules: string[] = [],
  tonePresetId?: string | null
): Promise<string[][]> {
  const shape =
    format === 'thread'
      ? 'Each variation is a thread of 2 to 6 posts that read well in order; the first post must make people want to read on.'
      : 'Each variation is a single post, so its posts array has exactly one element.';
  const toneRule = captionTonePromptRule(tonePresetId);

  const { variations } = await askClaude({
    scope,
    feature: format === 'thread' ? 'thread-variations' : 'post-variations',
    schema: VariationsFormat,
    task: [
      `Write ${AI_POST_VARIATIONS} clearly different social media post variations based on the input.`,
      shape,
      lengthRule(maxLength),
      'Write in the language of the input.',
      toneRule,
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
async function shrink(scope: ClientScope, post: string, maxLength: number): Promise<string> {
  for (let attempt = 0; attempt < SHRINK_ATTEMPTS && post.length > maxLength; attempt++) {
    const { post: shorter } = await askClaude({
      scope,
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
  async status(scope: ClientScope): Promise<AiStatus> {
    const [configured, imageConfigured] = await Promise.all([
      aiSettingsService.isTextConfigured(scope),
      aiSettingsService
        .resolveImageConfig(scope)
        .then(() => true)
        .catch(() => false),
    ]);
    return { configured, imageConfigured };
  },

  async generatePosts(scope: ClientScope, body: GeneratePostsBody): Promise<AiPostVariations> {
    return {
      variations: await writeVariations(
        scope,
        body.content,
        body.format,
        body.maxLength,
        [],
        body.tonePresetId
      ),
      source: null,
    };
  },

  async generatePostsFromUrl(scope: ClientScope, body: UrlPostsBody): Promise<AiPostVariations> {
    if (!(await aiSettingsService.isTextConfigured(scope))) {
      // fail before loading the page when AI is switched off
      throw new HttpError(
        503,
        'AI is not configured. An admin can set a provider + API key on the Agent page.'
      );
    }
    const page = await fetchWebPage(body.url);
    const source = [page.title ? `Title: ${page.title}` : '', page.text]
      .filter(Boolean)
      .join('\n\n');

    return {
      variations: await writeVariations(
        scope,
        `<web_page>\n${source}\n</web_page>`,
        body.format,
        body.maxLength,
        [
          'The input is the text of a web page. Write about its main article only and ignore menus, ads and cookie notices.',
          `End the first post of every variation with this link: ${page.url}`,
        ],
        body.tonePresetId
      ),
      source: { url: page.url, title: page.title },
    };
  },

  async generateReel(scope: ClientScope, body: GenerateReelBody): Promise<AiReelScript> {
    const reel = await askClaude({
      scope,
      feature: 'reel-script',
      schema: ReelFormat,
      task: reelTask(body.platform, body.lengthSeconds, captionTonePromptRule(body.tonePresetId)),
      input: body.content,
    });
    return normalizeReel(reel);
  },

  // Studies pasted competitor content for its hook/structure/angle, then writes ORIGINAL content
  // in our brand voice. The system prompt treats <input> as untrusted data, so the paste can't
  // steer the model; the task also forbids copying any wording, claims, offers or names.
  async generateFromCompetitor(
    scope: ClientScope,
    body: CompetitorContentBody
  ): Promise<AiCompetitorResult> {
    const toneRule = captionTonePromptRule(body.tonePresetId);
    const guardrails = [
      'The input contains example posts from a COMPETITOR, supplied for inspiration only.',
      'First, study what makes them work: the hook style, structure, angle, length, and call to action.',
      'Then write ORIGINAL content for our own brand in our brand voice. Never copy their wording, claims, offers, prices, product names or brand name, and never mention the competitor.',
      body.notes ? `Extra direction from us: ${body.notes}` : '',
      'Put a short, plain-language read of what works in their content in the "analysis" field (2–4 sentences).',
    ].filter(Boolean);

    if (body.format === 'reel') {
      const { analysis, reel } = await askClaude({
        scope,
        feature: 'competitor-reel',
        schema: CompetitorReelFormat,
        task: [
          ...guardrails,
          'Then, in the "reel" field, write our own reel inspired by that style.',
          reelTask(body.platform, body.lengthSeconds, toneRule),
        ].join('\n'),
        input: body.examples,
      });
      return { format: 'reel', analysis: analysis.trim(), reel: normalizeReel(reel) };
    }

    const { analysis, variations } = await askClaude({
      scope,
      feature: 'competitor-post',
      schema: CompetitorPostFormat,
      task: [
        ...guardrails,
        `Then, in the "variations" field, write ${AI_POST_VARIATIONS} clearly different single-post variations inspired by that style. Each variation's posts array has exactly one element.`,
        toneRule,
      ]
        .filter(Boolean)
        .join('\n'),
      input: body.examples,
    });

    return {
      format: 'post',
      analysis: analysis.trim(),
      variations: variations
        .map((variation) => cleanPosts(variation.posts))
        .filter((posts) => posts.length),
    };
  },

  async splitThread(scope: ClientScope, body: SplitThreadBody): Promise<AiThread> {
    const { posts } = await askClaude({
      scope,
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
      posts: await Promise.all(cleaned.map((post) => shrink(scope, post, body.maxLength))),
    };
  },

  // Idea → detailed prompt (Claude when available, else local engineering) → OpenAI image(s)
  // saved to the selected client's media library. Soft-fails with 503 when OPENAI_API_KEY is unset.
  async generateImage(scope: ClientScope, body: GenerateImageBody): Promise<MediaItem[]> {
    const imageConfig = await aiSettingsService.resolveImageConfig(scope);
    const orientation = resolveOrientation(body);
    const brandKit = await brandKitService.get(scope);
    const brandNotes = brandVisualNotes(brandKit);
    const idea = composeImageIdea(body.prompt, body.style, body.platformSize, brandNotes);

    let prompt: string;
    if (await aiSettingsService.isTextConfigured(scope)) {
      const expanded = await askClaude({
        scope,
        feature: 'image-prompt',
        schema: ImagePromptFormat,
        task: [
          'Turn the idea in the input into a detailed prompt for an image generator.',
          'Describe the subject, composition, style, lighting and colours; for realistic images also describe the camera and lens.',
          'Honour any Style, Frame, brand colour and visual-style lines already in the input — weave them in, do not drop them.',
          'Do not ask for any text inside the image unless the input explicitly wants it.',
        ].join('\n'),
        input: idea,
        effort: 'low',
      });
      prompt = expanded.prompt.trim() || localImagePrompt(idea);
    } else {
      prompt = localImagePrompt(idea);
    }

    const requested = body.count ?? 1;
    const payloads =
      imageConfig.provider === 'gemini'
        ? await generateGeminiImages(imageConfig, prompt, requested)
        : await generateOpenAiImages(imageConfig, prompt, IMAGE_SIZES[orientation], requested);

    if (payloads.length === 0) {
      throw new HttpError(502, 'The AI did not return an image. Try again.');
    }

    const stamp = Date.now();
    return Promise.all(
      payloads.map(async (base64, index) => {
        const bytes = Buffer.from(base64, 'base64');
        return mediaService.upload({
          scope,
          fileName: `ai-image-${stamp}${payloads.length > 1 ? `-${index + 1}` : ''}.png`,
          body: new Blob([new Uint8Array(bytes)]).stream(),
          declaredSize: bytes.byteLength,
        });
      })
    );
  },
};
