import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { getIntegrationQueue, INTEGRATION_JOB } from '@/modules/social/server/integrations/integration.queue';

const bodySchema = z.object({
  email: z.string().email().max(200),
  workspaceName: z.string().trim().min(1).max(200).optional(),
});

/**
 * Public form on /data-deletion: records a request and queues cleanup.
 * Meta's signed callback remains POST /api/meta/data-deletion.
 */
export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const body = bodySchema.parse(json);
    const confirmationCode = createHash('sha256')
      .update(`${body.email}:${randomBytes(8).toString('hex')}`)
      .digest('hex')
      .slice(0, 16);

    await prisma.dataDeletionRequest.create({
      data: {
        confirmationCode,
        email: body.email,
        workspaceName: body.workspaceName ?? null,
        status: 'processing',
        source: 'web_form',
      },
    });

    await getIntegrationQueue().add(INTEGRATION_JOB.processDeletionRequest, {
      confirmationCode,
    });

    const { APP_URL } = getServerEnv();
    return Response.json(
      {
        confirmation_code: confirmationCode,
        url: `${APP_URL}/data-deletion?code=${confirmationCode}`,
        status: 'processing',
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Lookup status by confirmation code (also used when Meta redirects to /data-deletion?code=). */
export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get('code')?.trim();
    if (!code) {
      throw new HttpError(400, 'Missing confirmation code');
    }
    const row = await prisma.dataDeletionRequest.findUnique({
      where: { confirmationCode: code },
      select: {
        confirmationCode: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });
    if (!row) {
      throw new HttpError(404, 'No deletion request found for that code');
    }
    return Response.json({
      confirmation_code: row.confirmationCode,
      status: row.status,
      created_at: row.createdAt.toISOString(),
      completed_at: row.completedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
