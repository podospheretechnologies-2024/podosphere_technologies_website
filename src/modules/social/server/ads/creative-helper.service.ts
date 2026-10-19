import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentUser } from '@/modules/auth/server/session';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { askClaude, isClaudeConfigured } from '../ai/claude.client';
import type { AdsCreativeHelperBody } from './ads.schema';
import { adsService } from './ads.service';

/**
 * Ads creative helper (SOCIAL_PENDING F14).
 *
 * Storage: F7 `SocialAiAction` with toolName `queue_ad_creative` (pending approval).
 * A short SocialAiThread is created so the action can sit in the same approval queue.
 *
 * Safety guarantees (enforced here — there is no Meta write path in this module):
 * - Never calls the Marketing API (no publish, no creatives upload, no status/budget change).
 * - Never mutates AdEntity spend/status fields.
 * - Only creates pending SocialAiAction (+ notification). Humans must approve before use.
 */

export const ADS_CREATIVE_TOOL = 'queue_ad_creative' as const;

const CreativeFormat = z.object({
  variations: z
    .array(
      z.object({
        primaryText: z.string(),
        headline: z.string(),
      })
    )
    .min(3)
    .max(3),
  imagePrompt: z.string().nullable().optional(),
});

const PayloadSchema = z.object({
  adAccountExternalId: z.string(),
  adSetExternalId: z.string().nullable().optional(),
  adSetName: z.string().nullable().optional(),
  campaignName: z.string().nullable().optional(),
  variations: z.array(
    z.object({
      primaryText: z.string(),
      headline: z.string(),
    })
  ),
  imagePrompt: z.string().nullable().optional(),
});

export interface AdCreativeVariation {
  primaryText: string;
  headline: string;
}

export interface AdCreativeDraftItem {
  id: string;
  threadId: string;
  adAccountExternalId: string;
  adSetExternalId: string | null;
  adSetName: string | null;
  campaignName: string | null;
  variations: AdCreativeVariation[];
  imagePrompt: string | null;
  status: string;
  createdAt: string;
}

function customerIdFromScope(scope: ClientScope): string | null {
  return scope.customerIds !== 'all' && scope.customerIds.length === 1 ? scope.customerIds[0] : null;
}

function toItem(row: {
  id: string;
  threadId: string;
  payload: unknown;
  status: string;
  createdAt: Date;
}): AdCreativeDraftItem | null {
  const parsed = PayloadSchema.safeParse(row.payload);
  if (!parsed.success) return null;
  const p = parsed.data;
  return {
    id: row.id,
    threadId: row.threadId,
    adAccountExternalId: p.adAccountExternalId,
    adSetExternalId: p.adSetExternalId ?? null,
    adSetName: p.adSetName ?? null,
    campaignName: p.campaignName ?? null,
    variations: p.variations,
    imagePrompt: p.imagePrompt ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

async function resolveAdSetContext(
  scope: ClientScope,
  body: AdsCreativeHelperBody
): Promise<{ adSetName: string | null; campaignName: string | null; objective: string | null }> {
  let adSetName = body.adSetName?.trim() || null;
  let campaignName = body.campaignName?.trim() || null;
  let objective = body.objective?.trim() || null;

  if (!body.adSetId) {
    return { adSetName, campaignName, objective };
  }

  const account = await prisma.adAccount.findFirst({
    where: { externalId: body.adAccountId, ...scopeWhere(scope) },
    select: { id: true },
  });
  if (!account) {
    return { adSetName, campaignName, objective };
  }

  const entity = await prisma.adEntity.findFirst({
    where: { adAccountId: account.id, externalId: body.adSetId, level: 'adset' },
  });
  if (entity) {
    adSetName ??= entity.name;
    objective ??= entity.objective;
    if (!campaignName && entity.parentId) {
      const campaign = await prisma.adEntity.findFirst({
        where: { adAccountId: account.id, externalId: entity.parentId, level: 'campaign' },
        select: { name: true, objective: true },
      });
      if (campaign) {
        campaignName = campaign.name;
        objective ??= campaign.objective;
      }
    }
  }

  return { adSetName, campaignName, objective };
}

export const creativeHelperService = {
  /**
   * Generate 3 primary-text + headline pairs (+ optional image prompt) from the client brand kit,
   * queue as a pending SocialAiAction. Does not touch Meta or spend.
   */
  async generate(scope: ClientScope, body: AdsCreativeHelperBody): Promise<AdCreativeDraftItem> {
    if (!isClaudeConfigured()) {
      throw new HttpError(503, 'AI is not configured (set ANTHROPIC_API_KEY)');
    }

    await adsService.requireAccount(scope, body.adAccountId);
    const ctx = await resolveAdSetContext(scope, body);
    const customerId = customerIdFromScope(scope);
    const user = await getCurrentUser();

    const contextLines = [
      `Ad account: ${body.adAccountId}`,
      ctx.adSetName ? `Ad set: ${ctx.adSetName}` : null,
      body.adSetId ? `Ad set id: ${body.adSetId}` : null,
      ctx.campaignName ? `Campaign: ${ctx.campaignName}` : null,
      ctx.objective ? `Objective: ${ctx.objective}` : null,
      body.brief?.trim() ? `Brief: ${body.brief.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const imageRule = body.includeImagePrompt
      ? 'Also write one detailed imagePrompt suitable for an image generator (subject, composition, style, lighting, brand colours; no text in the image unless the brief demands it).'
      : 'Set imagePrompt to null.';

    const result = await askClaude({
      scope,
      feature: 'ads-creative-helper',
      schema: CreativeFormat,
      task: [
        'Write Meta ads creative copy for this brand.',
        'Return exactly 3 clearly different variations.',
        'Each variation needs primaryText (ad body, 1–3 short sentences, under 125 words) and headline (under 40 characters, punchy).',
        'Match brand voice; do not invent discounts, prices, guarantees or metrics that are not in the brief.',
        'Do not mention that you are an AI.',
        imageRule,
        'This output is a draft for human approval only — it will not be published automatically.',
      ].join('\n'),
      input: contextLines || 'No ad set context. Write general on-brand Meta ad creatives.',
      effort: 'medium',
    });

    const variations: AdCreativeVariation[] = result.variations.map((v) => ({
      primaryText: v.primaryText.trim(),
      headline: v.headline.trim().slice(0, 40),
    }));
    if (variations.some((v) => !v.primaryText || !v.headline)) {
      throw new HttpError(502, 'The AI did not return usable creatives. Try again.');
    }

    const imagePrompt =
      body.includeImagePrompt && result.imagePrompt?.trim() ? result.imagePrompt.trim() : null;

    const label = ctx.adSetName ?? body.adAccountId;
    const payload = {
      adAccountExternalId: body.adAccountId,
      adSetExternalId: body.adSetId ?? null,
      adSetName: ctx.adSetName,
      campaignName: ctx.campaignName,
      variations,
      imagePrompt,
    };
    const payloadJson = payload as unknown as Prisma.InputJsonValue;

    const thread = await prisma.socialAiThread.create({
      data: {
        organizationId: scope.organizationId,
        customerId,
        userId: user?.id ?? null,
        title: `Ad creatives: ${label}`.slice(0, 200),
      },
    });

    await prisma.socialAiMessage.create({
      data: {
        threadId: thread.id,
        role: 'assistant',
        content: {
          type: 'ads_creative_draft',
          summary: `Queued ${variations.length} Meta ad creative variations for approval.`,
          payload,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const action = await prisma.socialAiAction.create({
      data: {
        organizationId: scope.organizationId,
        customerId,
        threadId: thread.id,
        toolName: ADS_CREATIVE_TOOL,
        payload: payloadJson,
        status: 'pending',
      },
    });

    await prisma.socialNotification.create({
      data: {
        organizationId: scope.organizationId,
        type: 'approval_needed',
        content: `AI ad creatives ready for review (${label}). 3 draft variations queued — not published.`,
        link: '/dashboard/social/ads',
      },
    });

    const item = toItem(action);
    if (!item) {
      throw new HttpError(500, 'Failed to store creative draft');
    }
    return item;
  },

  /** List pending (or all) queue_ad_creative actions for the current client scope. */
  async list(scope: ClientScope, status: 'pending' | 'all' = 'pending'): Promise<AdCreativeDraftItem[]> {
    const rows = await prisma.socialAiAction.findMany({
      where: {
        ...scopeWhere(scope),
        toolName: ADS_CREATIVE_TOOL,
        ...(status === 'pending' ? { status: 'pending' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toItem).filter((item): item is AdCreativeDraftItem => item !== null);
  },
};
