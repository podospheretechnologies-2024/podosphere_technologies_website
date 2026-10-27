import type { NextRequest } from 'next/server';
import { invitationService } from '@/modules/auth/server/invitation.service';
import { acceptInvitationSchema } from '@/modules/auth/server/invitation.schema';
import { toCurrentUserItem } from '@/modules/auth/server/auth.service';
import { createSession } from '@/modules/auth/server/session';
import { errorResponse, HttpError } from '@/shared/server/http-error';

/** Preview an invite (who it is for) without consuming it — drives the accept form. Public. */
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) throw new HttpError(400, 'Missing invite token');
    const preview = await invitationService.previewInvitation(token);
    return Response.json(preview);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Accept an invite: create the account, open a session, return the signed-in user. Public. */
export async function POST(request: NextRequest) {
  try {
    const body = acceptInvitationSchema.parse(await request.json());
    const user = await invitationService.acceptInvitation(body.token, {
      name: body.name,
      password: body.password,
    });
    await createSession(user.id, user.organizationId);
    return Response.json(toCurrentUserItem(user));
  } catch (error) {
    return errorResponse(error);
  }
}
