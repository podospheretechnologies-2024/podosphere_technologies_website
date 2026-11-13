import 'server-only';
import { HttpError } from '@/shared/server/http-error';
import type { AskImage, ResolvedAiConfig, StructuredAsk, StructuredResult } from './types';
import { fetchWithTimeout, toGeminiSchema, wrapTaskInput } from './shared';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  modelVersion?: string;
}

function userParts(task: string, input: string, images: AskImage[] | undefined): GeminiPart[] {
  const parts: GeminiPart[] = (images ?? []).map((image) => ({
    inlineData: { mimeType: image.mimeType, data: image.data.toString('base64') },
  }));
  parts.push({ text: wrapTaskInput(task, input) });
  return parts;
}

const RETRYABLE = new Set([429, 503]);
const MAX_ATTEMPTS = 3;
const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

/** Google's 404 text often says gemini-3.0-flash, but ListModels uses the preview id. */
const GEMINI_MODEL_ALIASES: Record<string, string> = {
  'gemini-3.0-flash': DEFAULT_GEMINI_MODEL,
  'gemini-3-flash': DEFAULT_GEMINI_MODEL,
  'gemini-2.5-flash': DEFAULT_GEMINI_MODEL,
  'gemini-2.0-flash': DEFAULT_GEMINI_MODEL,
  'gemini-1.5-flash': DEFAULT_GEMINI_MODEL,
  'gemini-1.5-flash-latest': DEFAULT_GEMINI_MODEL,
  'gemini-flash-latest': DEFAULT_GEMINI_MODEL,
};

function resolveGeminiModel(model: string): string {
  const trimmed = model.trim();
  return GEMINI_MODEL_ALIASES[trimmed] ?? trimmed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function googleErrorMessage(bodyText: string): string | null {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    const message = parsed.error?.message?.trim();
    return message || null;
  } catch {
    return null;
  }
}

function httpError(status: number, bodyText: string): HttpError {
  if (status === 400) return new HttpError(400, 'Gemini rejected the request.');
  if (status === 401 || status === 403) return new HttpError(503, 'The Gemini API key is invalid');
  if (status === 404) {
    return new HttpError(
      404,
      `That Gemini model is not available for this key. Set Model to ${DEFAULT_GEMINI_MODEL} on the Agent page.`
    );
  }
  if (status === 429) {
    return new HttpError(429, 'The AI is busy or its quota is used up. Try again later.');
  }
  if (status === 503) {
    return new HttpError(
      503,
      `Gemini is overloaded right now. Wait a minute, or switch Model to ${DEFAULT_GEMINI_MODEL} on the Agent page.`
    );
  }
  console.error('Gemini API error', status, bodyText.slice(0, 500));
  return new HttpError(502, 'The AI service is not available right now. Try again.');
}

export async function geminiStructured(
  cfg: ResolvedAiConfig,
  ask: StructuredAsk
): Promise<StructuredResult> {
  const modelId = resolveGeminiModel(cfg.model);
  if (modelId !== cfg.model) {
    console.warn(`Gemini model "${cfg.model}" remapped to "${modelId}"`);
  }

  const contents: GeminiContent[] = [
    ...(ask.history ?? [])
      .filter((turn) => turn.content.trim().length > 0)
      .map(
        (turn): GeminiContent => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        })
      ),
    { role: 'user', parts: userParts(ask.task, ask.input, ask.images) },
  ];

  const body = {
    systemInstruction: { parts: ask.system.map((text) => ({ text })) },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(ask.schema),
    },
  };

  const url = `${BASE_URL}/models/${encodeURIComponent(modelId)}:generateContent`;
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': cfg.apiKey },
    body: JSON.stringify(body),
  };

  let response: Response | undefined;
  let lastBody = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      response = await fetchWithTimeout(url, init, REQUEST_TIMEOUT_MS);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(504, 'The AI took too long to respond. Try again.');
      }
      throw new HttpError(502, 'The AI service is not available right now. Try again.');
    }

    if (response.ok) break;

    lastBody = await response.text().catch(() => '');
    const retryable = RETRYABLE.has(response.status) && attempt < MAX_ATTEMPTS;
    if (!retryable) {
      throw httpError(response.status, lastBody);
    }
    console.warn(
      `Gemini ${response.status} on ${modelId} (attempt ${attempt}/${MAX_ATTEMPTS}); retrying…`
    );
    await sleep(800 * attempt);
  }

  if (!response?.ok) {
    throw httpError(response?.status ?? 502, lastBody);
  }

  const data = (await response.json()) as GeminiResponse;
  const usage = {
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    cacheReadTokens: data.usageMetadata?.cachedContentTokenCount ?? 0,
    cacheWriteTokens: 0,
  };
  const model = data.modelVersion ?? modelId;
  const candidate = data.candidates?.[0];

  if (data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
    return { model, usage, outcome: { kind: 'refusal' } };
  }
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text || candidate?.finishReason === 'MAX_TOKENS') {
    return { model, usage, outcome: { kind: 'empty' } };
  }

  try {
    const parsed = ask.schema.parse(JSON.parse(text));
    return { model, usage, outcome: { kind: 'ok', parsed } };
  } catch {
    return { model, usage, outcome: { kind: 'empty' } };
  }
}
