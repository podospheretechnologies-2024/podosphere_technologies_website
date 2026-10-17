import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import {
  AI_WEEKLY_PLAN_JOB,
  AI_WEEKLY_PLAN_QUEUE_NAME,
  closeWeeklyPlanQueue,
  getWeeklyPlanQueue,
  type WeeklyPlanJobData,
} from './weekly-plan.queue';
import { weeklyPlanService } from './weekly-plan.service';

/** Weekly Monday 04:00 UTC sweep. */
const WEEKLY_SWEEP_PATTERN = '0 4 * * 1';

function processJob(job: Job) {
  switch (job.name) {
    case AI_WEEKLY_PLAN_JOB.generate:
      return weeklyPlanService.generateForClient(job.data as WeeklyPlanJobData);
    case AI_WEEKLY_PLAN_JOB.sweep:
      return weeklyPlanService.sweep();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startWeeklyPlanWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getWeeklyPlanQueue();

  await queue.upsertJobScheduler(
    AI_WEEKLY_PLAN_JOB.sweep,
    { pattern: WEEKLY_SWEEP_PATTERN, tz: 'UTC' },
    { name: AI_WEEKLY_PLAN_JOB.sweep }
  );

  const worker = new Worker(AI_WEEKLY_PLAN_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: 2,
  });

  worker.on('failed', (job, error) => {
    console.error(`[weekly-plan-worker] ${job?.name} failed: ${error.message}`);
  });

  worker.on('completed', (job) => {
    console.log(`[weekly-plan-worker] ${job.name} completed (${job.id})`);
  });

  return {
    async close() {
      await worker.close();
      await closeWeeklyPlanQueue();
    },
  };
}
