import 'server-only';
import { HttpError } from '@/shared/server/http-error';
import { fetchWithTimeout } from './shared';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

type ImagePart = { inlineData?: { mimeType?: string; data?: string } };

interface ImageResponse {
  candidates?: { content?: { parts?: ImagePart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

/**
 * One image from Gemini's image model via `:generateContent` with IMAGE output.
 * Gemini returns a single image per call, so the caller loops for more than one.
 */
export async function geminiGenerateImage(input: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<GeneratedImage | null> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${BASE_URL}/models/${encodeURIComponent(input.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': input.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      },
      REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, 'Image generation took too long. Try again.');
    }
    throw new HttpError(502, 'The image service is not available right now. Try again.');
  }

  if (!response.ok) {
    const status = response.status;
    const bodyText = await response.text().catch(() => '');
    if (status === 401 || status === 403) return Promise.reject(new HttpError(503, 'The Gemini API key is invalid'));
    if (status === 429) {
      return Promise.reject(
        new HttpError(429, 'The image service is busy or its quota is used up. Try again later.')
      );
    }
    if (status === 400) return Promise.reject(new HttpError(400, 'Gemini rejected the image request.'));
    console.error('Gemini image error', status, bodyText.slice(0, 500));
    return Promise.reject(new HttpError(502, 'The image service is not available right now. Try again.'));
  }

  const data = (await response.json()) as ImageResponse;
  if (data.promptFeedback?.blockReason) {
    throw new HttpError(422, 'The image request was blocked. Try a different prompt.');
  }
  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? 'image/png' };
    }
  }
  return null;
}
