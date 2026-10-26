import 'server-only';
import OpenAI from 'openai';
import { HttpError } from '@/shared/server/http-error';
import type { AskImage, ResolvedAiConfig, StructuredAsk, StructuredResult } from './types';
import { safeSchemaName, toOpenAiJsonSchema, wrapTaskInput } from './shared';

const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_OUTPUT_TOKENS = 8000;

const clients = new Map<string, OpenAI>();

function clientFor(apiKey: string): OpenAI {
  let client = clients.get(apiKey);
  if (!client) {
    client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
    clients.set(apiKey, client);
  }
  return client;
}

function userContent(
  task: string,
  input: string,
  images: AskImage[] | undefined
): OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content'] {
  const text = wrapTaskInput(task, input);
  if (!images?.length) return text;
  return [
    ...images.map((image) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${image.mimeType};base64,${image.data.toString('base64')}` },
    })),
    { type: 'text' as const, text },
  ];
}

function mapError(error: unknown): unknown {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return new HttpError(503, 'The OpenAI API key is invalid');
    if (error.status === 429) {
      return new HttpError(429, 'The AI is busy or its quota is used up. Try again later.');
    }
    if (error.status === 400) return new HttpError(400, error.message);
    console.error('OpenAI API error', error.status, error.message);
    return new HttpError(502, 'The AI service is not available right now. Try again.');
  }
  return error;
}

export async function openaiStructured(
  cfg: ResolvedAiConfig,
  ask: StructuredAsk
): Promise<StructuredResult> {
  const client = clientFor(cfg.apiKey);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: ask.system.join('\n\n') },
    ...(ask.history ?? [])
      .filter((turn) => turn.content.trim().length > 0)
      .map((turn) => ({ role: turn.role, content: turn.content })),
    { role: 'user', content: userContent(ask.task, ask.input, ask.images) },
  ];

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
      model: cfg.model,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: safeSchemaName(ask.schemaName),
          schema: toOpenAiJsonSchema(ask.schema),
          strict: true,
        },
      },
    });
  } catch (error) {
    throw mapError(error);
  }

  const usage = {
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
    cacheReadTokens: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: 0,
  };
  const model = completion.model;
  const choice = completion.choices[0];

  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
    return { model, usage, outcome: { kind: 'refusal' } };
  }
  const text = choice?.message?.content;
  if (!text || choice?.finish_reason === 'length') {
    return { model, usage, outcome: { kind: 'empty' } };
  }

  try {
    const parsed = ask.schema.parse(JSON.parse(text));
    return { model, usage, outcome: { kind: 'ok', parsed } };
  } catch {
    return { model, usage, outcome: { kind: 'empty' } };
  }
}
