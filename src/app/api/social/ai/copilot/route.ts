import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { agentService } from '@/modules/social/server/ai/agent/agent.service';
import { getAccess } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';

/**
 * A5 compatibility shim over F7 threads.
 * Prefer `/api/social/ai/threads` + `/api/social/ai/threads/[id]/messages` for new UI.
 */
const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  threadId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const threadId = request.nextUrl.searchParams.get('threadId')?.trim();
    if (!threadId) throw new HttpError(400, 'threadId is required');
    const thread = await agentService.getThread(scope, threadId);
    return Response.json({ threadId: thread.id, ...thread });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = bodySchema.parse(await request.json());
    const { user } = await getAccess();

    let threadId = body.threadId;
    if (!threadId) {
      const created = await agentService.createThread(scope, {
        userId: user.id,
        title: body.message.trim().slice(0, 80),
      });
      threadId = created.id;
    }

    const thread = await agentService.postMessage(scope, threadId, body.message);
    const pendingDraft = thread.actions.find(
      (action) => action.status === 'pending' && action.toolName === 'create_post_draft'
    );
    const draftPost =
      pendingDraft && pendingDraft.payload && typeof pendingDraft.payload === 'object'
        ? String((pendingDraft.payload as { content?: unknown }).content ?? '')
        : '';

    return Response.json({
      threadId: thread.id,
      reply: thread.replyText,
      draftPost,
      needsApproval: Boolean(draftPost),
      messages: thread.messages,
      actions: thread.actions,
      configured: thread.configured,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
