import 'server-only';
import { z } from 'zod';

/** User message body shared by the providers: task first, then the user content fenced as data. */
export function wrapTaskInput(task: string, input: string): string {
  return `${task}\n\n<input>\n${input}\n</input>`;
}

/** OpenAI's json_schema `name` must match ^[a-zA-Z0-9_-]+$. */
export function safeSchemaName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  return cleaned.length > 0 ? cleaned : 'result';
}

type JsonNode = Record<string, unknown>;

function isNode(value: unknown): value is JsonNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * OpenAI structured outputs (strict): every object must set `additionalProperties:false`
 * and list all of its properties in `required`. We drop validation keywords OpenAI does not
 * honour in strict mode and keep only the structural ones.
 */
export function toOpenAiJsonSchema(schema: z.ZodType): JsonNode {
  const base = z.toJSONSchema(schema, { reused: 'inline' }) as JsonNode;
  return sanitizeOpenAi(base);
}

const OPENAI_KEEP = new Set([
  'type',
  'properties',
  'items',
  'required',
  'enum',
  'anyOf',
  'description',
  'additionalProperties',
]);

function sanitizeOpenAi(node: unknown): JsonNode {
  if (!isNode(node)) return {} as JsonNode;
  const out: JsonNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (!OPENAI_KEEP.has(key)) continue;
    if (key === 'properties' && isNode(value)) {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([prop, sub]) => [prop, sanitizeOpenAi(sub)])
      );
    } else if (key === 'items') {
      out.items = sanitizeOpenAi(value);
    } else if (key === 'anyOf' && Array.isArray(value)) {
      out.anyOf = value.map((sub) => sanitizeOpenAi(sub));
    } else {
      out[key] = value;
    }
  }
  if (isNode(out.properties)) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

/**
 * Gemini `responseSchema` accepts an OpenAPI-subset Schema. It rejects `additionalProperties`
 * and most JSON-Schema validation keywords, so we keep only the structural subset it documents.
 */
export function toGeminiSchema(schema: z.ZodType): JsonNode {
  const base = z.toJSONSchema(schema, { reused: 'inline' }) as JsonNode;
  return sanitizeGemini(base);
}

const GEMINI_KEEP = new Set([
  'type',
  'description',
  'nullable',
  'enum',
  'items',
  'properties',
  'required',
  'minItems',
  'maxItems',
]);

function sanitizeGemini(node: unknown): JsonNode {
  if (!isNode(node)) return {} as JsonNode;
  const out: JsonNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (!GEMINI_KEEP.has(key)) continue;
    if (key === 'properties' && isNode(value)) {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([prop, sub]) => [prop, sanitizeGemini(sub)])
      );
    } else if (key === 'items') {
      out.items = sanitizeGemini(value);
    } else if (key === 'type' && typeof value === 'string') {
      // Gemini's Schema.type is the OpenAPI enum (STRING, OBJECT, ...), not JSON-Schema lowercase.
      out.type = value.toUpperCase();
    } else {
      out[key] = value;
    }
  }
  if (isNode(out.properties)) {
    out.required = Object.keys(out.properties);
  }
  return out;
}

/** fetch with a hard timeout (providers reached over REST, e.g. Gemini). */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
