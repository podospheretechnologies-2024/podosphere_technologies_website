import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { requirePortalSessionReady } from '@/shared/server/portal-session';
import { errorResponse } from '@/shared/server/http-error';

type Context = RouteContext<'/api/approver/posts/[group]'>;

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'note']),
  reason: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest, ctx: Context) {
  try {
    const session = await requirePortalSessionReady();
    const { group } = await ctx.params;
    const body = bodySchema.parse(await request.json());

    if (body.action === 'note') {
      const text = body.note ?? body.reason;
      if (!text) {
        return Response.json({ error: 'Write a short note' }, { status: 400 });
      }
      const result = await approvalService.portalAddNote(session, group, text);
      return Response.json(result);
    }

    if (body.action === 'reject' && !(body.reason ?? '').trim()) {
      return Response.json({ error: 'Tell us what to change' }, { status: 400 });
    }

    const result = await approvalService.portalDecide(
      session,
      group,
      body.action,
      body.reason
    );
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
