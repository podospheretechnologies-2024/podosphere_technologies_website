import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import {
  closeReportQueue,
  getReportQueue,
  REPORT_JOB,
  REPORT_MONTHLY_CRON,
  REPORT_QUEUE_NAME,
  type MonthlyReportJobData,
} from './report.queue';
import { reportService } from './report.service';

function processJob(job: Job) {
  switch (job.name) {
    case REPORT_JOB.generateMonthly:
      return reportService.generateMonthlyPdf(job.data as MonthlyReportJobData);
    case REPORT_JOB.scheduleMonthly:
      return reportService.enqueueScheduledMonthlyDeliveries();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startReportWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getReportQueue();

  await queue.upsertJobScheduler(
    REPORT_JOB.scheduleMonthly,
    { pattern: REPORT_MONTHLY_CRON, tz: 'UTC' },
    { name: REPORT_JOB.scheduleMonthly }
  );

  const worker = new Worker(REPORT_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: 2,
  });

  worker.on('failed', (job, error) => {
    console.error(`[report-worker] ${job?.name} failed: ${error.message}`);
  });

  worker.on('completed', (job) => {
    console.log(`[report-worker] ${job.name} completed (${job.id})`);
  });

  return {
    async close() {
      await worker.close();
      await closeReportQueue();
    },
  };
}
