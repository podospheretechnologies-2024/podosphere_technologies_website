import type { NextRequest } from 'next/server';
import { withApiKey } from '@/modules/social/server/api-clients/api-client.service';
import { prisma } from '@/shared/lib/prisma';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    return await withApiKey('analytics:read', request, async ({ organizationId }) => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [published, drafts, errors] = await Promise.all([
        prisma.socialPost.count({ where: { organizationId, state: 'PUBLISHED', deletedAt: null, publishDate: { gte: since } } }),
        prisma.socialPost.count({ where: { organizationId, state: 'DRAFT', deletedAt: null } }),
        prisma.socialPost.count({ where: { organizationId, state: 'ERROR', deletedAt: null } }),
      ]);
      return Response.json({ periodDays: 30, published, drafts, errors });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
