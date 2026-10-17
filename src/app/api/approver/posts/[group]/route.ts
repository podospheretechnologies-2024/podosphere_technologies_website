import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { getPortalSession } from '@/shared/server/portal-session';
import { errorResponse } from '@/shared/server/http-error';

type Context = RouteContext<'/api/approver/posts/[group]'>;

const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest, ctx: Context) {
  try {
    const session = await getPortalSession();
    const { group } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const result = await approvalService.portalDecide(session, group, body.action, body.reason);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
