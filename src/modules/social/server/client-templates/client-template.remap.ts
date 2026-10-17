import 'server-only';
import type { Prisma } from '@/generated/prisma/client';

/** Set content shape we care about when remapping channels. */
export type RemappableSetContent = {
  integrationIds?: string[];
  tagIds?: string[];
  values?: unknown;
  /** Providers selected on the source set; used to re-bind after channels connect. */
  channelProviders?: string[];
};

export type SourceChannelRef = { id: string; providerIdentifier: string };

/**
 * Remap set `integrationIds` through oldId → newId.
 * Unmapped IDs are dropped. Other content fields are preserved.
 */
export function remapSetIntegrationIds(
  content: unknown,
  oldIdToNewId: Map<string, string>
): RemappableSetContent {
  const raw = (content && typeof content === 'object' && !Array.isArray(content)
    ? content
    : {}) as RemappableSetContent;

  const integrationIds = (raw.integrationIds ?? [])
    .map((id) => oldIdToNewId.get(id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  // De-dupe while preserving order
  const seen = new Set<string>();
  const uniqueIds: string[] = [];
  for (const id of integrationIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniqueIds.push(id);
  }

  return {
    ...raw,
    integrationIds: uniqueIds,
  };
}

/**
 * Build old integration id → new id by matching `providerIdentifier`.
 * Multiple channels with the same provider are paired in encounter order.
 */
export function buildIntegrationIdMap(
  sourceChannels: SourceChannelRef[],
  targetChannels: { id: string; providerIdentifier: string }[]
): Map<string, string> {
  const pools = new Map<string, string[]>();
  for (const channel of targetChannels) {
    const list = pools.get(channel.providerIdentifier) ?? [];
    list.push(channel.id);
    pools.set(channel.providerIdentifier, list);
  }

  const map = new Map<string, string>();
  for (const source of sourceChannels) {
    const pool = pools.get(source.providerIdentifier);
    if (!pool || pool.length === 0) continue;
    const next = pool.shift()!;
    map.set(source.id, next);
  }
  return map;
}

/**
 * Derive ordered provider list from a set's old integration IDs + source channel refs.
 * Stored on cloned sets so channels can be re-bound after OAuth connect.
 */
export function channelProvidersFromContent(
  content: unknown,
  sourceChannels: SourceChannelRef[]
): string[] {
  const raw = (content && typeof content === 'object' && !Array.isArray(content)
    ? content
    : {}) as RemappableSetContent;
  const byId = new Map(sourceChannels.map((c) => [c.id, c.providerIdentifier]));
  return (raw.integrationIds ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
}

/**
 * Fill integrationIds from channelProviders using the customer's live channels
 * (match by providerIdentifier, consume in order).
 */
export function bindSetChannelsFromProviders(
  content: unknown,
  targetChannels: { id: string; providerIdentifier: string }[]
): RemappableSetContent {
  const raw = (content && typeof content === 'object' && !Array.isArray(content)
    ? content
    : {}) as RemappableSetContent;

  const providers = raw.channelProviders;
  if (!providers || providers.length === 0) {
    // Fall back: content may still hold old IDs — caller should remap via buildIntegrationIdMap.
    return raw;
  }

  const pools = new Map<string, string[]>();
  for (const channel of targetChannels) {
    const list = pools.get(channel.providerIdentifier) ?? [];
    list.push(channel.id);
    pools.set(channel.providerIdentifier, list);
  }

  const integrationIds: string[] = [];
  const seen = new Set<string>();
  for (const provider of providers) {
    const pool = pools.get(provider);
    if (!pool || pool.length === 0) continue;
    const id = pool.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    integrationIds.push(id);
  }

  return { ...raw, integrationIds };
}

export function toInputJson(content: RemappableSetContent): Prisma.InputJsonValue {
  return content as unknown as Prisma.InputJsonValue;
}
