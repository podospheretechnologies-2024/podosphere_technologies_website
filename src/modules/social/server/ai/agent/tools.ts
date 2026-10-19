import 'server-only';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { analyticsService } from '../../analytics/analytics.service';
import { inboxService } from '../../inbox/inbox.service';
import { customerIdFromScope } from '../claude.client';

const DAY_MS = 24 * 60 * 60 * 1000;

export type AgentToolContext = {
  scope: ClientScope;
  threadId: string;
};

function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Read + write tools. Scope is closed over from the session — never taken from model args. */
export function buildAgentTools(ctx: AgentToolContext) {
  const { scope, threadId } = ctx;
  const customerId = customerIdFromScope(scope);

  const getAnalytics = betaZodTool({
    name: 'get_analytics',
    description:
      'Summarise publishing and engagement analytics for the current client scope over a date range.',
    inputSchema: z.object({
      startDate: z.string().describe('ISO-8601 start datetime (inclusive)'),
      endDate: z.string().describe('ISO-8601 end datetime (exclusive or end of range)'),
    }),
    run: async (args) => {
      const summary = await analyticsService.summary(
        scope.organizationId,
        { startDate: args.startDate, endDate: args.endDate },
        scope.customerIds
      );
      return compactJson({
        totals: summary.totals,
        successRate: summary.successRate,
        channels: summary.channels.map((c) => ({
          id: c.id,
          name: c.name,
          provider: c.providerName,
          published: c.published,
          failed: c.failed,
          metrics: c.metrics,
        })),
        topPosts: summary.posts.slice(0, 8).map((p) => ({
          id: p.id,
          content: p.content.slice(0, 160),
          publishDate: p.publishDate,
          channel: p.channel.name,
          metrics: p.metrics,
        })),
      });
    },
  });

  const listScheduledPosts = betaZodTool({
    name: 'list_scheduled_posts',
    description: 'List upcoming queued (scheduled) posts in the current client scope.',
    inputSchema: z.object({
      from: z.string().optional().describe('ISO-8601 start; default now'),
      to: z.string().optional().describe('ISO-8601 end; default 30 days from now'),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (args) => {
      const from = args.from ? new Date(args.from) : new Date();
      const to = args.to ? new Date(args.to) : new Date(Date.now() + 30 * DAY_MS);
      const limit = args.limit ?? 20;
      const rows = await prisma.socialPost.findMany({
        where: {
          ...scopeWhere(scope),
          deletedAt: null,
          parentPostId: null,
          state: 'QUEUE',
          publishDate: { gte: from, lt: to },
        },
        select: {
          id: true,
          group: true,
          content: true,
          publishDate: true,
          state: true,
          integration: { select: { id: true, name: true, providerIdentifier: true } },
        },
        orderBy: { publishDate: 'asc' },
        take: limit,
      });
      return compactJson({
        count: rows.length,
        posts: rows.map((row) => ({
          id: row.id,
          group: row.group,
          content: row.content.slice(0, 200),
          publishDate: row.publishDate.toISOString(),
          channel: row.integration.name,
          provider: row.integration.providerIdentifier,
        })),
      });
    },
  });

  const listLeads = betaZodTool({
    name: 'list_leads',
    description: 'List leads in the current client scope, optionally filtered by pipeline stage.',
    inputSchema: z.object({
      stage: z.string().optional().describe('Pipeline stage, e.g. new, contacted, qualified'),
    }),
    run: async (args) => {
      const leads = await inboxService.listLeads(scope, { stage: args.stage });
      return compactJson({ count: leads.length, leads: leads.slice(0, 40) });
    },
  });

  const createPostDraft = betaZodTool({
    name: 'create_post_draft',
    description:
      'Queue a post draft for human approval. Does NOT publish. Returns a pending action id.',
    inputSchema: z.object({
      content: z.string().min(1).max(10000),
      integrationId: z.string().optional().describe('Channel id when known; otherwise first channel is used on approve'),
      scheduledAt: z.string().optional().describe('Optional ISO datetime suggestion for scheduling'),
    }),
    run: async (args) => {
      const action = await prisma.socialAiAction.create({
        data: {
          organizationId: scope.organizationId,
          customerId,
          threadId,
          toolName: 'create_post_draft',
          payload: {
            content: args.content,
            integrationId: args.integrationId ?? null,
            scheduledAt: args.scheduledAt ?? null,
          },
          status: 'pending',
        },
      });
      return compactJson({
        queued: true,
        status: 'pending',
        actionId: action.id,
        message: 'Draft queued for approval. It will not publish until a human approves it.',
      });
    },
  });

  const replyToConversation = betaZodTool({
    name: 'reply_to_conversation',
    description:
      'Queue a reply to an inbox conversation for human approval. Does NOT send until approved.',
    inputSchema: z.object({
      conversationId: z.string().describe('Inbox thread id (SocialInboxThread.id)'),
      text: z.string().min(1).max(4000),
    }),
    run: async (args) => {
      const action = await prisma.socialAiAction.create({
        data: {
          organizationId: scope.organizationId,
          customerId,
          threadId,
          toolName: 'reply_to_conversation',
          payload: {
            conversationId: args.conversationId,
            text: args.text,
          },
          status: 'pending',
        },
      });
      return compactJson({
        queued: true,
        status: 'pending',
        actionId: action.id,
        message: 'Reply queued for approval. It will not send until a human approves it.',
      });
    },
  });

  return [getAnalytics, listScheduledPosts, listLeads, createPostDraft, replyToConversation];
}
