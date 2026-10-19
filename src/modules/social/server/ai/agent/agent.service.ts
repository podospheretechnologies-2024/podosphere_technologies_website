import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { inboxService } from '../../inbox/inbox.service';
import { postService } from '../../posts/post.service';
import { customerIdFromScope } from '../claude.client';
import { runAgentTurn } from './agent-runner';

function customerIdForThread(scope: ClientScope): string | null {
  return customerIdFromScope(scope);
}

function textBlocks(text: string): Prisma.InputJsonValue {
  return [{ type: 'text', text }] as Prisma.InputJsonValue;
}

function serializeThread(
  thread: {
    id: string;
    organizationId: string;
    customerId: string | null;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
    messages: Array<{ id: string; role: string; content: unknown; createdAt: Date }>;
    actions: Array<{
      id: string;
      toolName: string;
      payload: unknown;
      status: string;
      result: unknown;
      createdAt: Date;
      reviewedAt: Date | null;
    }>;
  }
) {
  return {
    id: thread.id,
    organizationId: thread.organizationId,
    customerId: thread.customerId,
    title: thread.title,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      text: extractText(m.content),
      createdAt: m.createdAt.toISOString(),
    })),
    actions: thread.actions.map((a) => ({
      id: a.id,
      toolName: a.toolName,
      payload: a.payload,
      status: a.status,
      result: a.result,
      createdAt: a.createdAt.toISOString(),
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
    })),
  };
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b): b is { type: string; text?: string } => !!b && typeof b === 'object')
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
    .trim();
}

async function loadThreadOrThrow(scope: ClientScope, threadId: string) {
  const thread = await prisma.socialAiThread.findFirst({
    where: { id: threadId, ...scopeWhere(scope) },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      actions: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!thread) throw new HttpError(404, 'Thread not found');
  return thread;
}

export const agentService = {
  async createThread(scope: ClientScope, input: { title?: string; userId?: string | null }) {
    const thread = await prisma.socialAiThread.create({
      data: {
        organizationId: scope.organizationId,
        customerId: customerIdForThread(scope),
        userId: input.userId ?? null,
        title: input.title?.trim() || null,
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        actions: { orderBy: { createdAt: 'desc' } },
      },
    });
    return serializeThread(thread);
  },

  async getThread(scope: ClientScope, threadId: string) {
    return serializeThread(await loadThreadOrThrow(scope, threadId));
  },

  async postMessage(scope: ClientScope, threadId: string, message: string) {
    const thread = await loadThreadOrThrow(scope, threadId);

    await prisma.socialAiMessage.create({
      data: {
        threadId: thread.id,
        role: 'user',
        content: textBlocks(message),
      },
    });

    const history = [
      ...thread.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: textBlocks(message) },
    ];

    const turn = await runAgentTurn({
      scope,
      threadId: thread.id,
      history,
    });

    await prisma.socialAiMessage.create({
      data: {
        threadId: thread.id,
        role: 'assistant',
        content: turn.assistantContent,
      },
    });

    if (!thread.title) {
      const title = message.trim().slice(0, 80);
      await prisma.socialAiThread.update({
        where: { id: thread.id },
        data: { title, updatedAt: new Date() },
      });
    } else {
      await prisma.socialAiThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });
    }

    return {
      ...(await this.getThread(scope, thread.id)),
      replyText: turn.replyText,
      configured: turn.configured,
    };
  },

  async approveAction(scope: ClientScope, actionId: string, reviewedById?: string | null) {
    const action = await prisma.socialAiAction.findFirst({
      where: { id: actionId, ...scopeWhere(scope), status: 'pending' },
    });
    if (!action) throw new HttpError(404, 'Pending action not found');

    const payload = (action.payload ?? {}) as Record<string, unknown>;
    let result: Prisma.InputJsonValue = { ok: true };

    if (action.toolName === 'create_post_draft') {
      const content = String(payload.content ?? '').trim();
      if (!content) throw new HttpError(400, 'Draft content is missing');
      const integrationId =
        typeof payload.integrationId === 'string' && payload.integrationId
          ? payload.integrationId
          : undefined;
      const integration = integrationId
        ? await prisma.socialIntegration.findFirst({
            where: { id: integrationId, ...scopeWhere(scope), deletedAt: null },
          })
        : await prisma.socialIntegration.findFirst({
            where: { ...scopeWhere(scope), deletedAt: null, disabled: false },
            orderBy: { createdAt: 'asc' },
          });
      if (!integration) {
        throw new HttpError(400, 'Connect a channel before approving a draft');
      }
      const scheduledAt =
        typeof payload.scheduledAt === 'string' && payload.scheduledAt
          ? payload.scheduledAt
          : new Date().toISOString();
      const created = await postService.create(
        scope,
        {
          type: 'draft',
          date: scheduledAt,
          tagIds: [],
          posts: [
            {
              integrationId: integration.id,
              values: [{ content, mediaIds: [], delay: 0 }],
            },
          ],
        },
        'AI'
      );
      result = { ok: true, group: created.group, state: 'draft' };
    } else if (action.toolName === 'reply_to_conversation') {
      const conversationId = String(payload.conversationId ?? '');
      const text = String(payload.text ?? '').trim();
      if (!conversationId || !text) {
        throw new HttpError(400, 'Reply payload is incomplete');
      }
      const reply = await inboxService.reply(scope, conversationId, text);
      result = { ok: true, messageId: reply.message?.id ?? null };
    } else {
      throw new HttpError(400, `Unknown action tool: ${action.toolName}`);
    }

    const updated = await prisma.socialAiAction.update({
      where: { id: action.id },
      data: {
        status: 'approved',
        result,
        reviewedById: reviewedById ?? null,
        reviewedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      toolName: updated.toolName,
      status: updated.status,
      result: updated.result,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    };
  },

  async rejectAction(scope: ClientScope, actionId: string, reviewedById?: string | null) {
    const action = await prisma.socialAiAction.findFirst({
      where: { id: actionId, ...scopeWhere(scope), status: 'pending' },
    });
    if (!action) throw new HttpError(404, 'Pending action not found');

    const updated = await prisma.socialAiAction.update({
      where: { id: action.id },
      data: {
        status: 'rejected',
        result: { ok: false, reason: 'rejected' },
        reviewedById: reviewedById ?? null,
        reviewedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      toolName: updated.toolName,
      status: updated.status,
      result: updated.result,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    };
  },
};
