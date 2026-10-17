import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const AI_WEEKLY_PLAN_QUEUE_NAME = 'social-ai-weekly-plan-queue';

export const AI_WEEKLY_PLAN_JOB = {
  /** Generate a week of DRAFT posts for one client. */
  generate: 'ai.weekly-plan.generate',
  /** Cron: enqueue generate jobs for every client with active channels. */
  sweep: 'ai.weekly-plan.sweep',
} as const;

export interface WeeklyPlanJobData {
  organizationId: string;
  customerId: string;
}

let queue: Queue | undefined;

export function getWeeklyPlanQueue() {
  if (!queue) {
    queue = new Queue(AI_WEEKLY_PLAN_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 * 60 },
        removeOnComplete: { age: 24 * 60 * 60, count: 500 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
  }
  return queue;
}

export async function closeWeeklyPlanQueue() {
  await queue?.close();
  queue = undefined;
}
