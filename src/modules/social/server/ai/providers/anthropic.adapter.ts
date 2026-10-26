import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type {
  BetaContentBlockParam,
  BetaTextBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { HttpError } from '@/shared/server/http-error';
import type { AskImage, ResolvedAiConfig, StructuredAsk, StructuredResult } from './types';
import { wrapTaskInput } from './shared';

const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

// One client per key: keys vary per client/workspace, so we can't keep a single module singleton.
const clients = new Map<string, Anthropic>();

function clientFor(apiKey: string): Anthropic {
  let client = clients.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
    clients.set(apiKey, client);
  }
  return client;
}

/** Instructions first, brand kit last with a cache breakpoint (stable prefix → prompt caching). */
function systemBlocks(system: string[]): BetaTextBlockParam[] {
  return system.map((text, index) =>
    index === system.length - 1
      ? { type: 'text', text, cache_control: { type: 'ephemeral' } }
      : { type: 'text', text }
  );
}

function userContent(
  task: string,
  input: string,
  images: AskImage[] | undefined
): string | BetaContentBlockParam[] {
  const text = wrapTaskInput(task, input);
  if (!images?.length) return text;
  const blocks: BetaContentBlockParam[] = images.map((image) => ({
    type: 'image',
    source: { type: 'base64', media_type: image.mimeType, data: image.data.toString('base64') },
  }));
  blocks.push({ type: 'text', text });
  return blocks;
}

function mapError(error: unknown): unknown {
  if (error instanceof Anthropic.AuthenticationError) {
    return new HttpError(503, 'The Anthropic API key is invalid');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new HttpError(429, 'The AI is busy right now. Try again in a minute.');
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new HttpError(400, error.message);
  }
  if (error instanceof Anthropic.APIError) {
    console.error('Claude API error', error.status, error.message);
    return new HttpError(502, 'The AI service is not available right now. Try again.');
  }
  return error;
}

export async function anthropicStructured(
  cfg: ResolvedAiConfig,
  ask: StructuredAsk
): Promise<StructuredResult> {
  const client = clientFor(cfg.apiKey);
  const prior = (ask.history ?? [])
    .filter((turn) => turn.content.trim().length > 0)
    .map((turn) => ({ role: turn.role, content: turn.content }));

  let message;
  try {
    message = await client.beta.messages.parse({
      model: cfg.model,
      max_tokens: 16000,
      system: systemBlocks(ask.system),
      messages: [...prior, { role: 'user', content: userContent(ask.task, ask.input, ask.images) }],
      output_config: { effort: ask.effort, format: betaZodOutputFormat(ask.schema) },
      // If the model declines on policy grounds, the API retries on its default fallback model.
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    });
  } catch (error) {
    throw mapError(error);
  }

  const usage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };

  if (message.stop_reason === 'refusal') {
    return { model: message.model, usage, outcome: { kind: 'refusal' } };
  }
  if (message.stop_reason === 'max_tokens' || !message.parsed_output) {
    return { model: message.model, usage, outcome: { kind: 'empty' } };
  }
  return { model: message.model, usage, outcome: { kind: 'ok', parsed: message.parsed_output } };
}
