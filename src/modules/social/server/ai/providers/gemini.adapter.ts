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

function httpError(status: number, bodyText: string): HttpError {
  if (status === 400) return new HttpError(400, 'Gemini rejected the request.');
  if (status === 401 || status === 403) return new HttpError(503, 'The Gemini API key is invalid');
  if (status === 429) {
    return new HttpError(429, 'The AI is busy or its quota is used up. Try again later.');
  }
  console.error('Gemini API error', status, bodyText.slice(0, 500));
  return new HttpError(502, 'The AI service is not available right now. Try again.');
}

export async function geminiStructured(
  cfg: ResolvedAiConfig,
  ask: StructuredAsk
): Promise<StructuredResult> {
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

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${BASE_URL}/models/${encodeURIComponent(cfg.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': cfg.apiKey },
        body: JSON.stringify(body),
      },
      REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, 'The AI took too long to respond. Try again.');
    }
    throw new HttpError(502, 'The AI service is not available right now. Try again.');
  }

  if (!response.ok) {
    throw httpError(response.status, await response.text().catch(() => ''));
  }

  const data = (await response.json()) as GeminiResponse;
  const usage = {
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    cacheReadTokens: data.usageMetadata?.cachedContentTokenCount ?? 0,
    cacheWriteTokens: 0,
  };
  const model = data.modelVersion ?? cfg.model;
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
