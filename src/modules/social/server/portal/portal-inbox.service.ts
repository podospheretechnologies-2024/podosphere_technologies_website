import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { logAudit } from '@/shared/server/audit.service';
import type { ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import type { PortalSession } from '../approvals/approval.service';
import { inboxService } from '../inbox/inbox.service';

export type PortalInboxThreadRow = {
  id: string;
  platform: string;
  kind: 'comment' | 'dm' | null;
  contactName: string | null;
  preview: string | null;
  unreadCount: number;
  lastMessageAt: string;
  awaitingReply: boolean;
};

export type PortalInboxMessageRow = {
  id: string;
  direction: string;
  body: string;
  createdAt: string;
};

export type PortalInboxThreadDetail = PortalInboxThreadRow & {
  messages: PortalInboxMessageRow[];
};

export type PortalInboxSummary = {
  threads: PortalInboxThreadRow[];
};

export type PortalInboxReplyResult = {
  thread: PortalInboxThreadRow;
  message: PortalInboxMessageRow;
};

function portalScope(session: Pick<PortalSession, 'organizationId' | 'customerId'>): ClientScope {
  return { organizationId: session.organizationId, customerIds: [session.customerId] };
}

function mapKind(kind: string | null | undefined): 'comment' | 'dm' | null {
  return kind === 'comment' || kind === 'dm' ? kind : null;
}

/** Trailing inbound messages since the last outbound reply. */
function unreadFromDirections(directions: string[]): { unreadCount: number; awaitingReply: boolean } {
  let unreadCount = 0;
  for (let i = directions.length - 1; i >= 0; i -= 1) {
    if (directions[i] === 'inbound') {
      unreadCount += 1;
      continue;
    }
    break;
  }
  return { unreadCount, awaitingReply: unreadCount > 0 };
}

/**
 * Threads for this client: direct customerId match, or legacy rows whose channel
 * belongs to an integration linked to this customer.
 */
async function portalThreadWhere(
  session: Pick<PortalSession, 'organizationId' | 'customerId'>
): Promise<{
  organizationId: string;
  OR: Array<Record<string, unknown>>;
}> {
  const integrations = await prisma.socialIntegration.findMany({
    where: {
      organizationId: session.organizationId,
      customerId: session.customerId,
      deletedAt: null,
    },
    select: { internalId: true },
  });
  const channelIds = integrations.map((row) => row.internalId).filter(Boolean);

  return {
    organizationId: session.organizationId,
    OR: [
      { customerId: session.customerId },
      ...(channelIds.length > 0
        ? [{ channelInternalId: { in: channelIds }, customerId: null }]
        : []),
    ],
  };
}

function mapPortalThread(row: {
  id: string;
  platform: string;
  kind: string | null;
  contactName: string | null;
  lastPreview: string | null;
  lastMessageAt: Date;
  messages?: { direction: string }[];
}): PortalInboxThreadRow {
  const { unreadCount, awaitingReply } = unreadFromDirections(
    (row.messages ?? []).map((message) => message.direction)
  );
  return {
    id: row.id,
    platform: row.platform,
    kind: mapKind(row.kind),
    contactName: row.contactName,
    preview: row.lastPreview,
    unreadCount,
    lastMessageAt: row.lastMessageAt.toISOString(),
    awaitingReply,
  };
}

/**
 * Client-portal Inbox: session org + customer only.
 * No assignee, AI drafts, SLA internals, tokens, or other clients.
 */
export const portalInboxService = {
  async listThreads(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalInboxSummary> {
    const where = await portalThreadWhere(session);
    const rows = await prisma.socialInboxThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      select: {
        id: true,
        platform: true,
        kind: true,
        contactName: true,
        lastPreview: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { direction: true },
        },
      },
    });

    return { threads: rows.map(mapPortalThread) };
  },

  /** Alias used by existing portal page / API routes. */
  async list(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>
  ): Promise<PortalInboxSummary> {
    return this.listThreads(session);
  },

  async getThread(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    threadId: string
  ): Promise<PortalInboxThreadDetail> {
    const where = await portalThreadWhere(session);
    const thread = await prisma.socialInboxThread.findFirst({
      where: { id: threadId, ...where },
      select: {
        id: true,
        platform: true,
        kind: true,
        contactName: true,
        lastPreview: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            direction: true,
            body: true,
            createdAt: true,
          },
        },
      },
    });
    if (!thread) throw new HttpError(404, 'Thread not found');

    return {
      ...mapPortalThread(thread),
      messages: thread.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  },

  /**
   * Reply via admin inboxService with forced client scope — never trusts body clientId.
   * Call only from routes that already passed requirePortalTab('inbox', 'act').
   * Owned by Phase 4; kept here so act API and isolation tests stay wired.
   */
  async reply(
    session: PortalSession,
    threadId: string,
    text: string
  ): Promise<PortalInboxReplyResult> {
    await this.getThread(session, threadId);

    const result = await inboxService.reply(portalScope(session), threadId, text);

    await logAudit({
      action: 'portal.inbox.reply',
      targetType: 'inbox_thread',
      targetId: threadId,
      metadata: {
        customerId: session.customerId,
        approverId: session.approverId,
        messageId: result.message.id,
      },
    });

    return {
      thread: {
        id: result.id,
        platform: result.platform,
        kind: mapKind(result.kind),
        contactName: result.contactName,
        preview: result.lastPreview,
        unreadCount: 0,
        lastMessageAt: result.lastMessageAt,
        awaitingReply: false,
      },
      message: {
        id: result.message.id,
        direction: result.message.direction,
        body: result.message.body,
        createdAt: result.message.createdAt,
      },
    };
  },
};
