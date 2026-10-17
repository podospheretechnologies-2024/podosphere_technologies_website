import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Context = RouteContext<'/api/social/posts/[group]/approval'>;

const bodySchema = z.object({
  action: z.enum(['submit_internal', 'submit_client', 'approve', 'reject']),
  reason: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest, ctx: Context) {
  try {
    const { group } = await ctx.params;
    const scope = await getClientScope('approve');
    const body = bodySchema.parse(await request.json());
    const result = await approvalService.agencyAction(scope, group, body.action, body.reason);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
