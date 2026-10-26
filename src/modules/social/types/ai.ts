import type { AiProvider } from '../config/ai';

export interface AiStatus {
  configured: boolean;
  /** Image generation (OpenAI or Gemini) is set up; text AI can work without it. */
  imageConfigured: boolean;
}

export type AiSettingsSource = 'client' | 'workspace' | 'env';

/** Masked AI provider config shown in the admin panel. Never carries the raw API key. */
export interface AiProviderDisplay {
  /** Which level the current scope edits. */
  level: 'client' | 'workspace';
  /** Provider stored at this exact level (null = nothing stored here; inherits). */
  provider: AiProvider | null;
  model: string | null;
  keyLast4: string | null;
  /** What actually runs for this scope, and where it comes from. */
  effective: { provider: AiProvider; model: string; source: AiSettingsSource } | null;
}

export interface AiPostSource {
  url: string;
  title: string | null;
}

export interface AiPostVariations {
  /** Each variation is a thread: the first item is the post, the rest are comments. */
  variations: string[][];
  source: AiPostSource | null;
}

export interface AiThread {
  posts: string[];
}

/** One shot in a reel storyboard. */
export interface AiReelScene {
  /** Rough timing, e.g. "0–3s". */
  timecode: string;
  /** What to film or show on screen. */
  visual: string;
  /** Short text overlay (a few words). */
  onScreenText: string;
}

/** A ready-to-shoot short-video (Reel) script. */
export interface AiReelScript {
  /** One-line summary of the idea. */
  concept: string;
  /** Scroll-stopping opener for the first ~2 seconds. */
  hook: string;
  scenes: AiReelScene[];
  /** Suggested narration / what to say. */
  voiceover: string;
  /** Ready-to-post caption. */
  caption: string;
  hashtags: string[];
  /** Trending-audio vibe suggestion (described, not a copyrighted track name). */
  audioIdea: string;
  cta: string;
}

/**
 * Result of the competitor-inspired generator: a short read on what makes the
 * competitor's content work, plus our own original content in that style.
 */
export type AiCompetitorResult =
  | { format: 'post'; analysis: string; variations: string[][] }
  | { format: 'reel'; analysis: string; reel: AiReelScript };
