import 'server-only';
import type { ResolvedAiConfig, StructuredAsk, StructuredResult } from './types';
import { anthropicStructured } from './anthropic.adapter';
import { openaiStructured } from './openai.adapter';
import { geminiStructured } from './gemini.adapter';

/** Runs one structured generation on whichever provider the resolved config names. */
export function generateStructured(
  cfg: ResolvedAiConfig,
  ask: StructuredAsk
): Promise<StructuredResult> {
  switch (cfg.provider) {
    case 'anthropic':
      return anthropicStructured(cfg, ask);
    case 'openai':
      return openaiStructured(cfg, ask);
    case 'gemini':
      return geminiStructured(cfg, ask);
  }
}

export * from './types';
