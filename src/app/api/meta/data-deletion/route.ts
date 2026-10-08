import { createHash } from 'node:crypto';
import { parseMetaSignedRequest } from '@/modules/social/server/integrations/providers/meta/signed-request';
import { getServerEnv } from '@/shared/lib/env';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { getIntegrationQueue, INTEGRATION_JOB } from '@/modules/social/server/integrations/integration.queue';
import { prisma } from '@/shared/lib/prisma';

// Meta App settings → "Data deletion callback URL" points here. Meta POSTs a
// signed_request when a user removes the app and expects { url, confirmation_code }.
export async function POST(request: Request) {
  try {
    const { META_APP_SECRET, APP_URL } = getServerEnv();
    if (!META_APP_SECRET) {
      throw new HttpError(503, 'META_APP_SECRET is not configured');
    }

    // An empty or non-form body (e.g. a reachability probe) is a 400, not a 500.
    const form = await request.formData().catch(() => null);
    const signedRequest = form?.get('signed_request');
    if (typeof signedRequest !== 'string') {
      throw new HttpError(400, 'Missing signed_request');
    }
    const payload = parseMetaSignedRequest(signedRequest, META_APP_SECRET);

    const confirmationCode = createHash('sha256')
      .update(`${payload.user_id}:${payload.issued_at}`)
      .digest('hex')
      .slice(0, 16);
    console.info(
      `[meta] data deletion requested user=${payload.user_id} code=${confirmationCode}`
    );

    const integrations = await prisma.socialIntegration.findMany({
      where: {
        providerIdentifier: { in: ['facebook', 'instagram'] },
        additionalSettings: { path: '$.metaUserId', equals: payload.user_id }
      }
    });

    for (const integration of integrations) {
      await getIntegrationQueue().add(INTEGRATION_JOB.deleteData, { integrationId: integration.id });
    }

    return Response.json({
      url: `${APP_URL}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
