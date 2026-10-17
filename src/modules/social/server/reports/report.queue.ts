import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const REPORT_QUEUE_NAME = 'social-reports-queue';

export const REPORT_JOB = {
  /** Build a monthly PDF for one client from MySQL aggregates. */
  generateMonthly: 'reports.monthly.generate',
  /** Cron: enqueue generateMonthly (with email) for every active client. */
  scheduleMonthly: 'reports.monthly.schedule',
} as const;

/** 09:00 UTC on the 1st of each month — previous calendar month is then complete. */
export const REPORT_MONTHLY_CRON = '0 9 1 * *';

export interface MonthlyReportJobData {
  organizationId: string;
  customerId: string;
  /** Inclusive UTC month start; defaults to previous calendar month in the worker. */
  periodStart?: string;
  periodEnd?: string;
  /** When true, email the PDF link to ClientApprover addresses after generation. */
  deliverEmail?: boolean;
}

let queue: Queue | undefined;

export function getReportQueue() {
  if (!queue) {
    queue = new Queue(REPORT_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 * 60 },
        removeOnComplete: true,
      },
    });
  }
  return queue;
}

export async function closeReportQueue() {
  await queue?.close();
  queue = undefined;
}
