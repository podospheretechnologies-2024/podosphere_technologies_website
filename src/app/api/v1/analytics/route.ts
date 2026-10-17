import type { NextRequest } from 'next/server';
import { withApiKey } from '@/modules/social/server/api-clients/api-client.service';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    return await withApiKey('analytics:read', request, async ({ scope }) => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const base = { ...scopeWhere(scope), deletedAt: null };
      const [published, drafts, errors] = await Promise.all([
        prisma.socialPost.count({
          where: { ...base, state: 'PUBLISHED', publishDate: { gte: since } },
        }),
        prisma.socialPost.count({ where: { ...base, state: 'DRAFT' } }),
        prisma.socialPost.count({ where: { ...base, state: 'ERROR' } }),
      ]);
      return Response.json({ periodDays: 30, published, drafts, errors });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
