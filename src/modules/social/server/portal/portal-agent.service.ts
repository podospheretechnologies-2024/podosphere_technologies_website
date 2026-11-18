import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { organizationScope, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { agentService } from '../ai/agent/agent.service';
import { isClaudeConfigured } from '../ai/claude.client';
import type { PortalSession } from '../approvals/approval.service';

const PORTAL_AGENT_FEATURE = 'portal-agent';

export type PortalAgentSession = Pick<PortalSession, 'organizationId' | 'customerId'>;

export type PortalAgentThreadSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortalAgentMessage = {
  id: string;
  role: string;
  text: string;
  createdAt: string;
};

export type PortalAgentThread = PortalAgentThreadSummary & {
  messages: PortalAgentMessage[];
  configured?: boolean;
  replyText?: string;
};

function scopeFor(session: PortalAgentSession): ClientScope {
  // Always a single client — never 'all' and never another customerId.
  return organizationScope(session.organizationId, session.customerId);
}

function portalThreadWhere(session: PortalAgentSession) {
  return {
    organizationId: session.organizationId,
    customerId: session.customerId,
  };
}

function toPortalThread(
  thread: {
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
    messages: Array<{ id: string; role: string; text: string; createdAt: string }>;
  },
  extras?: { configured?: boolean; replyText?: string }
): PortalAgentThread {
  // Portal-safe: text only — no raw tool JSON, actions, tokens, cost, or org internals.
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      createdAt: m.createdAt,
    })),
    ...(extras?.configured !== undefined ? { configured: extras.configured } : {}),
    ...(extras?.replyText !== undefined ? { replyText: extras.replyText } : {}),
  };
}

/**
 * Client-portal AI chat scoped to the session client only.
 * organizationId + customerId always come from the portal session — never from the request body.
 */
export const portalAgentService = {
  /** Whether the agency has an AI key configured. Never exposes the key or model settings. */
  status(): { configured: boolean } {
    return { configured: isClaudeConfigured() };
  },

  async listThreads(session: PortalAgentSession): Promise<PortalAgentThreadSummary[]> {
    const rows = await prisma.socialAiThread.findMany({
      where: portalThreadWhere(session),
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  async getThread(session: PortalAgentSession, threadId: string): Promise<PortalAgentThread> {
    const scope = scopeFor(session);
    const thread = await agentService.getThread(scope, threadId);
    // Defence in depth: scopeWhere already filters, but refuse any mismatch.
    if (thread.customerId !== session.customerId || thread.organizationId !== session.organizationId) {
      throw new HttpError(404, 'Thread not found');
    }
    return toPortalThread(thread);
  },

  async createThread(
    session: PortalAgentSession,
    input?: { title?: string }
  ): Promise<PortalAgentThread> {
    const scope = scopeFor(session);
    const thread = await agentService.createThread(scope, {
      title: input?.title,
      userId: null,
    });
    if (thread.customerId !== session.customerId) {
      throw new HttpError(500, 'Thread was not scoped to this client');
    }
    return toPortalThread(thread);
  },

  /**
   * Send a message. Creates a new thread when `threadId` is omitted.
   * Usage is recorded under feature `portal-agent` against this org + client budget.
   */
  async sendMessage(
    session: PortalAgentSession,
    input: { message: string; threadId?: string }
  ): Promise<PortalAgentThread> {
    const scope = scopeFor(session);
    let threadId = input.threadId;

    if (!threadId) {
      const created = await agentService.createThread(scope, {
        title: input.message.trim().slice(0, 80),
        userId: null,
      });
      if (created.customerId !== session.customerId) {
        throw new HttpError(500, 'Thread was not scoped to this client');
      }
      threadId = created.id;
    } else {
      // Ensure the thread belongs to this client before spending AI budget.
      await this.getThread(session, threadId);
    }

    const result = await agentService.postMessage(scope, threadId, input.message, {
      feature: PORTAL_AGENT_FEATURE,
    });

    if (result.customerId !== session.customerId || result.organizationId !== session.organizationId) {
      throw new HttpError(404, 'Thread not found');
    }

    return toPortalThread(result, {
      configured: result.configured,
      replyText: result.replyText,
    });
  },
};
