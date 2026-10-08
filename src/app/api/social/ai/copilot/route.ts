import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { askClaude, isClaudeConfigured } from '@/modules/social/server/ai/claude.client';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

const replySchema = z.object({
  reply: z.string(),
  draftPost: z.string(),
  needsApproval: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    if (!isClaudeConfigured()) {
      throw new HttpError(503, 'Set ANTHROPIC_API_KEY to use the copilot');
    }
    const body = bodySchema.parse(await request.json());
    const result = await askClaude({
      organizationId: organization.id,
      feature: 'copilot',
      schema: replySchema,
      task: 'Answer the marketer. If they asked to write or change a post, put the post text in draftPost and set needsApproval true. Otherwise leave draftPost empty and needsApproval false. Never claim a post was published.',
      input: body.message,
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
