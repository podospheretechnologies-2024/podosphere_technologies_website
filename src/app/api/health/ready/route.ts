import { getAdsQueue, ADS_QUEUE_NAME } from '@/modules/social/server/ads/ads.queue';
import { getAlertQueue, ALERT_QUEUE_NAME } from '@/modules/social/server/alerts/alert.queue';
import {
  getAnalyticsQueue,
  ANALYTICS_QUEUE_NAME,
} from '@/modules/social/server/analytics/analytics.queue';
import {
  getAutomationQueue,
  AUTOMATION_QUEUE_NAME,
} from '@/modules/social/server/automation/automation.queue';
import {
  getWeeklyPlanQueue,
  AI_WEEKLY_PLAN_QUEUE_NAME,
} from '@/modules/social/server/ai/weekly-plan.queue';
import {
  getIntegrationQueue,
  INTEGRATION_QUEUE_NAME,
} from '@/modules/social/server/integrations/integration.queue';
import {
  getPublishQueue,
  PUBLISH_QUEUE_NAME,
} from '@/modules/social/server/publishing/publish.queue';
import { getReportQueue, REPORT_QUEUE_NAME } from '@/modules/social/server/reports/report.queue';
import { prisma } from '@/shared/lib/prisma';
import { getRedis } from '@/shared/lib/redis';

type CheckStatus = 'ok' | 'error';

type JobCounts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
};

/**
 * Readiness probe — DB + Redis. Soft degrade: always returns a body with
 * per-check status; HTTP 503 only when a dependency is down. Queue depths are
 * best-effort and omitted on failure.
 * Public: no auth.
 */
export async function GET() {
  const checks: { database: CheckStatus; redis: CheckStatus } = {
    database: 'error',
    redis: 'error',
  };
  const errors: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error) {
    errors.database = error instanceof Error ? error.message : 'unreachable';
  }

  try {
    const pong = await getRedis().ping();
    if (pong === 'PONG') {
      checks.redis = 'ok';
    } else {
      errors.redis = `unexpected ping reply: ${pong}`;
    }
  } catch (error) {
    errors.redis = error instanceof Error ? error.message : 'unreachable';
  }

  let queues: Record<string, JobCounts> | undefined;
  if (checks.redis === 'ok') {
    try {
      queues = await getQueueDepths();
    } catch {
      // Optional field — omit rather than fail readiness.
    }
  }

  const ready = checks.database === 'ok' && checks.redis === 'ok';
  const status = ready ? 'ok' : 'degraded';

  return Response.json(
    {
      status,
      checks,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
      ...(queues ? { queues } : {}),
    },
    { status: ready ? 200 : 503 }
  );
}

async function getQueueDepths(): Promise<Record<string, JobCounts>> {
  const entries = [
    [PUBLISH_QUEUE_NAME, getPublishQueue()],
    [AUTOMATION_QUEUE_NAME, getAutomationQueue()],
    [ANALYTICS_QUEUE_NAME, getAnalyticsQueue()],
    [ADS_QUEUE_NAME, getAdsQueue()],
    [INTEGRATION_QUEUE_NAME, getIntegrationQueue()],
    [ALERT_QUEUE_NAME, getAlertQueue()],
    [REPORT_QUEUE_NAME, getReportQueue()],
    [AI_WEEKLY_PLAN_QUEUE_NAME, getWeeklyPlanQueue()],
  ] as const;

  const counts: Record<string, JobCounts> = {};
  await Promise.all(
    entries.map(async ([name, queue]) => {
      const raw = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed'
      );
      counts[name] = {
        waiting: raw.waiting ?? 0,
        active: raw.active ?? 0,
        delayed: raw.delayed ?? 0,
        failed: raw.failed ?? 0,
        completed: raw.completed ?? 0,
      };
    })
  );
  return counts;
}
