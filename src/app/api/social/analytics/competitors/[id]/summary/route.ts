import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { getClientScope, organizationScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';
import { askClaude, isClaudeConfigured } from '@/modules/social/server/ai/claude.client';
import {
  engagementScore,
  parseCompetitorMedia,
  topPostsThisMonth,
} from '@/modules/social/server/analytics/competitor-media';

const SummarySchema = z.object({
  summary: z.string(),
  themes: z.array(z.string()).max(8),
  whatWorks: z.array(z.string()).max(6),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const scope = await getClientScope('view');
    const { id } = await params;

    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: 'AI is not configured. Set ANTHROPIC_API_KEY to enable summaries.' },
        { status: 503 }
      );
    }

    const competitor = await prisma.socialCompetitor.findFirst({
      where: { id, organizationId: scope.organizationId },
      include: {
        snapshots: { orderBy: { date: 'desc' }, take: 1 },
      },
    });

    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
    }

    const latest = competitor.snapshots[0];
    const media = parseCompetitorMedia(latest?.recentMedia);
    const top = topPostsThisMonth(media, 8);

    if (top.length === 0) {
      return NextResponse.json(
        { error: 'No recent media synced yet. Wait for tonight\'s competitor sync.' },
        { status: 400 }
      );
    }

    const facts = [
      `Competitor: ${competitor.name} (@${competitor.externalId}) on ${competitor.platform}`,
      `Followers: ${latest?.followers ?? 'unknown'}`,
      `Posts count (profile): ${latest?.postsCount ?? 'unknown'}`,
      `Engagement rate (avg of recent media): ${latest?.engagementRate ?? 'unknown'}%`,
      'Top posts this month (likes + comments):',
      ...top.map((post, index) => {
        const caption = (post.caption ?? '').replace(/\s+/g, ' ').slice(0, 220);
        return [
          `${index + 1}. type=${post.mediaType}`,
          `likes=${post.likeCount}`,
          `comments=${post.commentsCount}`,
          `engagement=${engagementScore(post)}`,
          `at=${post.timestamp}`,
          caption ? `caption="${caption}"` : 'caption=(none)',
        ].join(' ');
      }),
    ].join('\n');

    const aiScope = organizationScope(scope.organizationId, competitor.customerId);
    const result = await askClaude({
      scope: aiScope,
      feature: 'competitor-summary',
      schema: SummarySchema,
      task: [
        'Summarise what is working in this competitor’s recent Instagram content.',
        'Use only the facts in the input. Do not invent metrics or posts.',
        'summary: 3–5 short sentences for an agency account manager.',
        'themes: recurring content themes or formats you can see.',
        'whatWorks: concrete patterns (timing, format, hooks) supported by the numbers.',
      ].join('\n'),
      input: facts,
      effort: 'low',
    });

    return NextResponse.json({
      competitorId: competitor.id,
      name: competitor.name,
      ...result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
