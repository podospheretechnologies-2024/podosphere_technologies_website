import 'server-only';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { type ClientScope, scopeWhere } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { BRAND_KIT_FIELDS } from '../../config/brand-kit';
import { TAG_DEFAULT_COLOR } from '../../config/settings';
import { planService } from '../billing/plan.service';
import { postService } from '../posts/post.service';
import { tagRepository } from '../tags/tag.repository';
import { askClaude, isClaudeConfigured } from './claude.client';
import { brandKitService } from './brand-kit.service';
import {
  AI_WEEKLY_PLAN_JOB,
  getWeeklyPlanQueue,
  type WeeklyPlanJobData,
} from './weekly-plan.queue';

const WEEKLY_PLAN_TAG = 'Weekly plan';
const TOP_POSTS_LIMIT = 8;
const INSIGHT_LOOKBACK_DAYS = 28;
const POSTS_PER_WEEK_MIN = 3;
const POSTS_PER_WEEK_MAX = 7;

const WeeklyPlanFormat = z.object({
  posts: z
    .array(
      z.object({
        dayOffset: z.number().int().min(0).max(6),
        content: z.string().min(1),
        platformHint: z.string().optional(),
      })
    )
    .min(POSTS_PER_WEEK_MIN)
    .max(POSTS_PER_WEEK_MAX),
});

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Next Monday 09:00 UTC (or this Monday if today is Monday and before noon UTC). */
function weekPlanAnchor(now = new Date()): Date {
  const day = now.getUTCDay(); // 0 Sun … 6 Sat
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = startOfUtcDay(now);
  monday.setUTCDate(monday.getUTCDate() + daysUntilMonday);
  monday.setUTCHours(9, 0, 0, 0);
  if (day === 1 && now.getUTCHours() >= 12) {
    monday.setUTCDate(monday.getUTCDate() + 7);
  }
  return monday;
}

function brandKitSummary(kit: Record<string, string>): string {
  return BRAND_KIT_FIELDS.flatMap((field) => {
    const value = kit[field.key]?.trim();
    return value ? [`${field.label}: ${value}`] : [];
  }).join('\n');
}

async function resolveCustomerIds(scope: ClientScope): Promise<string[]> {
  if (scope.customerIds !== 'all') {
    return scope.customerIds;
  }
  const rows = await prisma.socialCustomer.findMany({
    where: { organizationId: scope.organizationId, deletedAt: null },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function ensureWeeklyPlanTag(organizationId: string, customerId: string): Promise<string> {
  const existing = await tagRepository.findByName(organizationId, customerId, WEEKLY_PLAN_TAG);
  if (existing) return existing.id;
  const created = await tagRepository.create(organizationId, customerId, {
    name: WEEKLY_PLAN_TAG,
    color: TAG_DEFAULT_COLOR,
  });
  return created.id;
}

function pickIntegration(
  integrations: { id: string; providerIdentifier: string }[],
  platformHint: string | undefined
): string {
  if (integrations.length === 0) {
    throw new HttpError(400, 'Connect a channel before generating a weekly plan');
  }
  if (platformHint) {
    const hint = platformHint.toLowerCase();
    const match = integrations.find((row) => {
      const id = row.providerIdentifier.toLowerCase();
      return (
        id.includes(hint) ||
        (hint.includes('instagram') && id.includes('instagram')) ||
        (hint.includes('facebook') && id.includes('facebook')) ||
        (hint.includes('linkedin') && id.includes('linkedin')) ||
        (hint.includes('twitter') && (id.includes('twitter') || id.includes('x-'))) ||
        (hint === 'x' && (id.includes('twitter') || id.includes('x-')))
      );
    });
    if (match) return match.id;
  }
  return integrations[0].id;
}

async function loadContext(organizationId: string, customerId: string) {
  const scope: ClientScope = { organizationId, customerIds: [customerId] };
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - INSIGHT_LOOKBACK_DAYS);

  const [customer, brandKit, integrations] = await Promise.all([
    prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    }),
    brandKitService.get(scope),
    prisma.socialIntegration.findMany({
      where: { ...scopeWhere(scope), deletedAt: null, disabled: false },
      select: { id: true, name: true, providerIdentifier: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!customer) {
    throw new HttpError(404, 'Client not found');
  }
  if (integrations.length === 0) {
    throw new HttpError(400, 'Connect a channel before generating a weekly plan');
  }

  const integrationIds = integrations.map((row) => row.id);

  const [topPosts, insightRows] = await Promise.all([
    prisma.socialExternalPost.findMany({
      where: {
        integrationId: { in: integrationIds },
        publishedAt: { gte: since },
      },
      orderBy: [{ engagementRate: 'desc' }, { reach: 'desc' }, { likes: 'desc' }],
      take: TOP_POSTS_LIMIT,
      select: {
        caption: true,
        likes: true,
        comments: true,
        reach: true,
        impressions: true,
        engagementRate: true,
        publishedAt: true,
        type: true,
      },
    }),
    prisma.socialInsightDaily.groupBy({
      by: ['metric'],
      where: {
        integrationId: { in: integrationIds },
        date: { gte: since },
      },
      _sum: { value: true },
    }),
  ]);

  const insights = insightRows
    .map((row) => `${row.metric}: ${row._sum.value ?? 0}`)
    .join('\n');

  const postsBlock = topPosts
    .map((post, index) => {
      const caption = (post.caption ?? '').trim().slice(0, 280) || '(no caption)';
      return [
        `${index + 1}. ${post.type} · ${post.publishedAt.toISOString().slice(0, 10)}`,
        `   likes=${post.likes ?? 0} comments=${post.comments ?? 0} reach=${post.reach ?? 0} eng=${post.engagementRate ?? 'n/a'}`,
        `   ${caption}`,
      ].join('\n');
    })
    .join('\n\n');

  return {
    customer,
    brandKit,
    integrations,
    facts: [
      `Client: ${customer.name}`,
      `Channels: ${integrations.map((row) => `${row.name} (${row.providerIdentifier})`).join(', ')}`,
      `Brand kit:\n${brandKitSummary(brandKit) || '(empty)'}`,
      `Recent insight totals (${INSIGHT_LOOKBACK_DAYS}d):\n${insights || '(none)'}`,
      `Top recent posts:\n${postsBlock || '(none)'}`,
    ].join('\n\n'),
  };
}

export const weeklyPlanService = {
  /**
   * Enqueue generate jobs for every client in the current dashboard scope.
   * Soft-skips when Claude is not configured (no 503).
   */
  async enqueueForScope(scope: ClientScope) {
    await planService.assertFeature(scope.organizationId, 'ai');

    if (!isClaudeConfigured()) {
      return {
        queued: 0,
        skipped: true as const,
        reason: 'AI is not configured. Set ANTHROPIC_API_KEY in .env.',
        jobs: [] as Array<{ customerId: string; jobId: string | undefined }>,
      };
    }

    const customerIds = await resolveCustomerIds(scope);
    if (customerIds.length === 0) {
      throw new HttpError(400, 'Select a client before generating a weekly plan');
    }

    const queue = getWeeklyPlanQueue();
    const jobs: Array<{ customerId: string; jobId: string | undefined }> = [];

    for (const customerId of customerIds) {
      const payload: WeeklyPlanJobData = {
        organizationId: scope.organizationId,
        customerId,
      };
      const job = await queue.add(AI_WEEKLY_PLAN_JOB.generate, payload, {
        jobId: `weekly_plan_${scope.organizationId}_${customerId}_${Date.now()}`,
      });
      jobs.push({ customerId, jobId: job.id });
    }

    return { queued: jobs.length, skipped: false as const, jobs };
  },

  /** Worker: find clients with channels and enqueue one generate job each. */
  async sweep(): Promise<{ queued: number }> {
    const channels = await prisma.socialIntegration.findMany({
      where: { deletedAt: null, disabled: false, customerId: { not: null } },
      select: { organizationId: true, customerId: true },
      distinct: ['organizationId', 'customerId'],
    });

    const queue = getWeeklyPlanQueue();
    let queued = 0;
    for (const row of channels) {
      if (!row.customerId) continue;
      try {
        await planService.assertFeature(row.organizationId, 'ai');
      } catch {
        continue;
      }
      if (!isClaudeConfigured()) {
        return { queued: 0 };
      }
      await queue.add(
        AI_WEEKLY_PLAN_JOB.generate,
        {
          organizationId: row.organizationId,
          customerId: row.customerId,
        } satisfies WeeklyPlanJobData,
        {
          jobId: `weekly_plan_sweep_${row.organizationId}_${row.customerId}`,
          removeOnComplete: true,
          removeOnFail: true,
        }
      );
      queued += 1;
    }
    return { queued };
  },

  /** Worker entry: Claude → DRAFT posts tagged "Weekly plan" at INTERNAL approval. */
  async generateForClient(data: WeeklyPlanJobData) {
    const { organizationId, customerId } = data;
    await planService.assertFeature(organizationId, 'ai');

    if (!isClaudeConfigured()) {
      return { created: 0, skipped: true as const, reason: 'AI is not configured' };
    }

    const scope: ClientScope = { organizationId, customerIds: [customerId] };
    const { customer, integrations, facts } = await loadContext(organizationId, customerId);

    let plan: z.infer<typeof WeeklyPlanFormat>;
    try {
      plan = await askClaude({
        scope,
        feature: 'weekly-plan',
        schema: WeeklyPlanFormat,
        task: [
          `Write a ${POSTS_PER_WEEK_MIN}–${POSTS_PER_WEEK_MAX} post content calendar for the next week for this client.`,
          'Each post needs dayOffset 0–6 (Mon–Sun), plain-text content (no markdown), and an optional platformHint (instagram, facebook, linkedin, x).',
          'Vary themes: one awareness, one product/value, one engagement/community. Match brand kit tone. Do not invent offers or metrics.',
          'Use only the facts in the input.',
        ].join('\n'),
        input: facts,
        effort: 'medium',
      });
    } catch (error) {
      console.error(`[weekly-plan] Claude failed for ${customer.name}`, error);
      return { created: 0, skipped: true as const, reason: 'AI call failed' };
    }

    const tagId = await ensureWeeklyPlanTag(organizationId, customerId);
    const anchor = weekPlanAnchor();
    const groups: string[] = [];

    for (const item of plan.posts) {
      const publishDate = new Date(anchor);
      publishDate.setUTCDate(publishDate.getUTCDate() + item.dayOffset);
      const integrationId = pickIntegration(integrations, item.platformHint);

      const created = await postService.create(
        scope,
        {
          type: 'draft',
          date: publishDate.toISOString(),
          tagIds: [tagId],
          posts: [
            {
              integrationId,
              values: [{ content: item.content.trim(), mediaIds: [], delay: 0 }],
            },
          ],
        },
        'AI'
      );

      await prisma.socialPost.updateMany({
        where: { organizationId, group: created.group, deletedAt: null },
        data: { approvalStep: 'INTERNAL' },
      });

      groups.push(created.group);
    }

    return {
      created: groups.length,
      skipped: false as const,
      groups,
      customerId,
      weekStart: anchor.toISOString(),
    };
  },
};
