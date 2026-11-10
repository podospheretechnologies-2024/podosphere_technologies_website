import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { videoIdeasService } from '@/modules/social/server/growth/records.service';
import { generateVideoIdeas } from '@/modules/social/server/growth/growth-ai.service';
import { prisma } from '@/shared/lib/prisma';

export async function GET() {
  try {
    const { gc } = await growthRequest('view');
    const [videos, competitors] = await Promise.all([
      videoIdeasService.list(gc.organizationId, gc.customerId),
      prisma.socialCompetitor.findMany({
        where: { organizationId: gc.organizationId, customerId: gc.customerId },
        select: { id: true, name: true, platform: true, externalId: true },
        take: 20,
      }),
    ]);
    return Response.json({ videos, competitors });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const { gc } = await growthRequest('draft');
    return Response.json(await generateVideoIdeas(gc), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
