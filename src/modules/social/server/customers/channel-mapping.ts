import 'server-only';
import { Prisma } from '@/generated/prisma/client';

/**
 * Rule R6 (PODO_ADMIN_AUDIT_FIX_PLAN.md 0.1): a channel's rows follow the channel when it is mapped,
 * moved or unmapped. Only rows that were on the channel's previous client (`from`) move, so a row
 * someone attributed by hand to another client stays where it is.
 */
export type ChannelForMapping = {
  id: string;
  providerIdentifier: string;
  internalId: string;
  additionalSettings: unknown;
};

export type ChannelRowCounts = { posts: number; threads: number; leads: number };

function facebookPageIdOf(channel: ChannelForMapping): string | null {
  if (channel.providerIdentifier === 'facebook') return channel.internalId;
  const settings = channel.additionalSettings as { facebookPageId?: string } | null;
  return settings?.facebookPageId ?? null;
}

function inboxPlatformOf(channel: ChannelForMapping): string | null {
  if (channel.providerIdentifier === 'facebook') return 'facebook';
  if (channel.providerIdentifier === 'instagram') return 'instagram';
  return null;
}

function customerIdEquals(value: string | null) {
  return value === null ? null : value;
}

/** Moves one channel's posts, inbox threads and leads from `from` to `to` (either may be null). */
export async function moveChannelRows(
  tx: Prisma.TransactionClient,
  organizationId: string,
  channel: ChannelForMapping,
  from: string | null,
  to: string | null
): Promise<ChannelRowCounts> {
  if (from === to) return { posts: 0, threads: 0, leads: 0 };

  const posts = await tx.socialPost.updateMany({
    where: { organizationId, integrationId: channel.id, customerId: customerIdEquals(from) },
    data: { customerId: to },
  });

  const platform = inboxPlatformOf(channel);
  const threads = platform
    ? await tx.socialInboxThread.updateMany({
        where: {
          organizationId,
          platform,
          channelInternalId: channel.internalId,
          customerId: customerIdEquals(from),
        },
        data: { customerId: to },
      })
    : { count: 0 };

  // Lead-form leads carry the Facebook Page id in their webhook payload.
  const pageId = channel.providerIdentifier === 'facebook' ? facebookPageIdOf(channel) : null;
  let leads = 0;
  if (pageId) {
    const fromSql = from === null ? Prisma.sql`customerId IS NULL` : Prisma.sql`customerId = ${from}`;
    leads = await tx.$executeRaw`
      UPDATE social_leads
      SET customerId = ${to}
      WHERE organizationId = ${organizationId}
        AND ${fromSql}
        AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.page_id')) = ${pageId}
    `;
  }

  return { posts: posts.count, threads: threads.count, leads };
}

/** Preview for the move confirm: how many rows would follow the channel. */
export async function countChannelRows(
  tx: Prisma.TransactionClient,
  organizationId: string,
  channel: ChannelForMapping,
  from: string | null
): Promise<ChannelRowCounts> {
  const posts = await tx.socialPost.count({
    where: { organizationId, integrationId: channel.id, customerId: customerIdEquals(from) },
  });
  const platform = inboxPlatformOf(channel);
  const threads = platform
    ? await tx.socialInboxThread.count({
        where: {
          organizationId,
          platform,
          channelInternalId: channel.internalId,
          customerId: customerIdEquals(from),
        },
      })
    : 0;
  const pageId = channel.providerIdentifier === 'facebook' ? facebookPageIdOf(channel) : null;
  let leads = 0;
  if (pageId) {
    const fromSql = from === null ? Prisma.sql`customerId IS NULL` : Prisma.sql`customerId = ${from}`;
    const rows = await tx.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM social_leads
      WHERE organizationId = ${organizationId}
        AND ${fromSql}
        AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.page_id')) = ${pageId}
    `;
    leads = Number(rows[0]?.n ?? 0);
  }
  return { posts, threads, leads };
}

export const CHANNEL_MAPPING_SELECT = {
  id: true,
  providerIdentifier: true,
  internalId: true,
  additionalSettings: true,
  customerId: true,
  name: true,
} as const;
