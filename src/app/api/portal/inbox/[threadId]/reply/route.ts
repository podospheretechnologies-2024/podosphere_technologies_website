import type { NextRequest } from 'next/server';
import { replyThreadSchema } from '@/modules/social/server/inbox/inbox.schema';
import { portalInboxService } from '@/modules/social/server/portal/portal-inbox.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

type Params = { params: Promise<{ threadId: string }> };

/** Client portal Inbox reply — requires inbox "Can act". */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePortalTab('inbox', 'act');
    const { threadId } = await params;
    const body = replyThreadSchema.parse(await request.json());
    const data = await portalInboxService.reply(session, threadId, body.text);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
