import 'server-only';
import type { z } from 'zod';
import type { AiProvider } from '../../../config/ai';

// Provider list + guard live in client-safe config/ai.ts; re-exported here for server callers.
export type { AiProvider };

/** A provider + key + model resolved for one request (DB config or .env fallback). */
export interface ResolvedAiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export type ClaudeVisionMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface AskImage {
  mimeType: ClaudeVisionMime;
  /** Raw image bytes (base64-encoded for the API). */
  data: Buffer;
}

export type HistoryTurn = { role: 'user' | 'assistant'; content: string };

/** Everything a provider adapter needs for one structured call. `system` parts join for
 *  OpenAI/Gemini; the Anthropic adapter caches the final part. */
export interface StructuredAsk {
  system: string[];
  task: string;
  input: string;
  images?: AskImage[];
  history?: HistoryTurn[];
  effort: 'low' | 'medium' | 'high';
  schema: z.ZodType;
  /** Stable label used where a provider needs a schema name (OpenAI json_schema). */
  schemaName: string;
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Usage is returned even on refusal/empty so the caller can still bill the tokens spent. */
export interface StructuredResult {
  model: string;
  usage: ProviderUsage;
  outcome: { kind: 'ok'; parsed: unknown } | { kind: 'refusal' } | { kind: 'empty' };
}

export type StructuredFn = (cfg: ResolvedAiConfig, ask: StructuredAsk) => Promise<StructuredResult>;
