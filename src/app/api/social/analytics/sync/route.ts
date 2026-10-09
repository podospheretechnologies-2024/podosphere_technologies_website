import { getAnalyticsQueue, ANALYTICS_JOB } from '@/modules/social/server/analytics/analytics.queue';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function POST() {
  try {
    // Only allow admins to trigger the sync
    await getCurrentOrganization();
    await requireRole('ADMIN');

    const queue = getAnalyticsQueue();
    
    // Add jobs to the queue to run immediately
    await queue.add(ANALYTICS_JOB.syncPosts, {}, { removeOnComplete: true });
    await queue.add(ANALYTICS_JOB.syncPostMetrics, {}, { removeOnComplete: true, delay: 5000 }); // Slight delay to let posts sync first
    await queue.add(ANALYTICS_JOB.syncDailyInsights, {}, { removeOnComplete: true });

    return Response.json({ success: true, message: 'Sync started in the background.' });
  } catch (error) {
    return errorResponse(error);
  }
}
