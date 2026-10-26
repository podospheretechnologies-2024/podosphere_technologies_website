import 'server-only';
import { z } from 'zod';
import { getServerEnv } from '@/shared/lib/env';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { ClientScope } from '@/shared/server/client-scope';
import { AI_PROVIDERS, isAiProvider, type AiProvider } from '../../config/ai';
import type { AiProviderDisplay, AiSettingsSource } from '../../types/ai';
import { generateStructured, type ResolvedAiConfig } from './providers';

/** Shape accepted by the save route. `apiKey` omitted = keep the stored key (edit model only). */
export const aiSettingsInputSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().trim().max(64).optional(),
  apiKey: z.string().trim().min(1).max(500).optional(),
});
export type AiSettingsInput = z.infer<typeof aiSettingsInputSchema>;

/** Test a key before saving: the key is required here. */
export const aiSettingsTestSchema = aiSettingsInputSchema.extend({
  apiKey: z.string().trim().min(1).max(500),
});
export type AiSettingsTestInput = z.infer<typeof aiSettingsTestSchema>;

type SettingsRow = {
  provider: string;
  model: string | null;
  apiKeyEncrypted: string | null;
};

function defaultModel(provider: AiProvider): string {
  const env = getServerEnv();
  switch (provider) {
    case 'anthropic':
      return env.ANTHROPIC_MODEL;
    case 'openai':
      return env.OPENAI_MODEL;
    case 'gemini':
      return env.GEMINI_MODEL;
  }
}

/** Single selected client → its id; 'All clients' → null (read-only: env / leftover workspace row). */
function levelCustomerId(scope: ClientScope): string | null {
  if (scope.customerIds === 'all') return null;
  if (scope.customerIds.length === 1) return scope.customerIds[0];
  throw new HttpError(400, 'Pick a single client to set the AI provider.');
}

/** UI keys are per client only. The .env key is the all-clients fallback. */
function requireClientId(scope: ClientScope): string {
  const customerId = levelCustomerId(scope);
  if (!customerId) {
    throw new HttpError(
      400,
      'Pick a client to set their AI provider. The server env key is used for every client that does not have its own.'
    );
  }
  return customerId;
}

function activeConfig(row: SettingsRow | undefined | null): ResolvedAiConfig | null {
  if (!row || !row.apiKeyEncrypted || !isAiProvider(row.provider)) return null;
  return {
    provider: row.provider,
    apiKey: decrypt(row.apiKeyEncrypted),
    model: row.model?.trim() || defaultModel(row.provider),
  };
}

function envTextConfig(): ResolvedAiConfig | null {
  const env = getServerEnv();
  if (env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL };
  }
  return null;
}

async function resolveWithSource(
  scope: ClientScope
): Promise<{ config: ResolvedAiConfig; source: AiSettingsSource } | null> {
  const organizationId = scope.organizationId;
  const customerId = levelCustomerId(scope);

  const rows = await prisma.socialAiSettings.findMany({
    where: customerId
      ? { organizationId, OR: [{ customerId }, { customerId: null }] }
      : { organizationId, customerId: null },
    select: { customerId: true, provider: true, model: true, apiKeyEncrypted: true },
  });

  if (customerId) {
    const clientConfig = activeConfig(rows.find((row) => row.customerId === customerId));
    if (clientConfig) return { config: clientConfig, source: 'client' };
  }
  const workspaceConfig = activeConfig(rows.find((row) => row.customerId === null));
  if (workspaceConfig) return { config: workspaceConfig, source: 'workspace' };

  const env = envTextConfig();
  return env ? { config: env, source: 'env' } : null;
}

export const aiSettingsService = {
  /** Resolved text provider for a request. Throws 503 when nothing is configured anywhere. */
  async resolveTextConfig(scope: ClientScope): Promise<ResolvedAiConfig> {
    const resolved = await resolveWithSource(scope);
    if (!resolved) {
      throw new HttpError(
        503,
        'AI is not configured. An admin can set a provider + API key on the Agent page, or set ANTHROPIC_API_KEY.'
      );
    }
    return resolved.config;
  },

  /** True when text generation would work for this scope (used by status()). */
  async isTextConfigured(scope: ClientScope): Promise<boolean> {
    return (await resolveWithSource(scope)) !== null;
  },

  /**
   * Image provider for a request. Gemini when the resolved text provider is Gemini; otherwise
   * OpenAI (the configured OpenAI key when provider = openai, else env OPENAI_API_KEY). Throws 503
   * when no image path is available.
   */
  async resolveImageConfig(
    scope: ClientScope
  ): Promise<{ provider: 'openai' | 'gemini'; apiKey: string; model: string }> {
    const env = getServerEnv();
    const resolved = await resolveWithSource(scope);
    const text = resolved?.config;

    if (text?.provider === 'gemini') {
      return { provider: 'gemini', apiKey: text.apiKey, model: env.GEMINI_IMAGE_MODEL };
    }
    const openaiKey = text?.provider === 'openai' ? text.apiKey : env.OPENAI_API_KEY;
    if (openaiKey) {
      return { provider: 'openai', apiKey: openaiKey, model: env.OPENAI_IMAGE_MODEL };
    }
    throw new HttpError(
      503,
      'Image generation needs an OpenAI key (set OPENAI_API_KEY) or a Gemini provider for this client.'
    );
  },

  /** Masked settings for the UI — stored config at this level + what actually runs. Never the key. */
  async getDisplay(scope: ClientScope): Promise<AiProviderDisplay> {
    const organizationId = scope.organizationId;
    const customerId = levelCustomerId(scope);
    const [row, resolved] = await Promise.all([
      prisma.socialAiSettings.findFirst({
        where: { organizationId, customerId },
        select: { provider: true, model: true, apiKeyEncrypted: true },
      }),
      resolveWithSource(scope),
    ]);

    const provider = row && isAiProvider(row.provider) ? row.provider : null;
    const keyLast4 = row?.apiKeyEncrypted ? decrypt(row.apiKeyEncrypted).slice(-4) : null;

    return {
      level: customerId ? 'client' : 'workspace',
      provider,
      model: row?.model ?? null,
      keyLast4,
      effective: resolved
        ? { provider: resolved.config.provider, model: resolved.config.model, source: resolved.source }
        : null,
    };
  },

  /** Upsert the config for one client. Overwrites the key only when a new one is supplied. */
  async save(scope: ClientScope, input: AiSettingsInput): Promise<AiProviderDisplay> {
    const organizationId = scope.organizationId;
    const customerId = requireClientId(scope);
    const model = input.model?.trim() || null;

    const existing = await prisma.socialAiSettings.findFirst({
      where: { organizationId, customerId },
      select: { id: true, apiKeyEncrypted: true },
    });

    if (!existing && !input.apiKey) {
      throw new HttpError(400, 'Enter an API key to turn on this provider.');
    }
    const apiKeyEncrypted = input.apiKey
      ? encrypt(input.apiKey)
      : (existing?.apiKeyEncrypted ?? null);

    if (existing) {
      await prisma.socialAiSettings.update({
        where: { id: existing.id },
        data: { provider: input.provider, model, apiKeyEncrypted },
      });
    } else {
      await prisma.socialAiSettings.create({
        data: { organizationId, customerId, provider: input.provider, model, apiKeyEncrypted },
      });
    }
    return this.getDisplay(scope);
  },

  /** Remove the client key so this client falls back to workspace / env. */
  async remove(scope: ClientScope): Promise<AiProviderDisplay> {
    const organizationId = scope.organizationId;
    const customerId = requireClientId(scope);
    await prisma.socialAiSettings.deleteMany({ where: { organizationId, customerId } });
    return this.getDisplay(scope);
  },

  /** One tiny live call to verify a key/provider/model, without persisting anything. */
  async test(input: AiSettingsTestInput): Promise<{ ok: true } | { ok: false; error: string }> {
    const cfg: ResolvedAiConfig = {
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model?.trim() || defaultModel(input.provider),
    };
    const schema = z.object({ ok: z.string() });
    try {
      const result = await generateStructured(cfg, {
        system: ['You are a connectivity check for an app. Answer exactly what is asked.'],
        task: 'Return a JSON object whose "ok" field is the word "ok".',
        input: 'ping',
        effort: 'low',
        schema,
        schemaName: 'connectivity_test',
      });
      if (result.outcome.kind === 'ok') return { ok: true };
      return { ok: false, error: 'The provider accepted the key but did not return a usable answer.' };
    } catch (error) {
      if (error instanceof HttpError) return { ok: false, error: error.message };
      return { ok: false, error: 'Could not reach the provider with that key.' };
    }
  },
};
