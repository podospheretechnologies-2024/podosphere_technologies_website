import { getAnalyticsQueue, ANALYTICS_JOB } from '@/modules/social/server/analytics/analytics.queue';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function POST() {
  try {
    await getClientScope('view');

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
