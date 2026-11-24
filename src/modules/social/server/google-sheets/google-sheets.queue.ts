import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const GOOGLE_SHEETS_QUEUE_NAME = 'social-google-sheets-queue';

export const GOOGLE_SHEETS_JOB = {
  /** Every connected organization (scheduler, every 15 min). */
  syncAll: 'googleSheets.syncAll',
  /** One organization, on demand. data: { organizationId } */
  syncOrg: 'googleSheets.syncOrg',
} as const;

let queue: Queue | undefined;

export function getGoogleSheetsQueue() {
  if (!queue) {
    queue = new Queue(GOOGLE_SHEETS_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

/** Queue one organization's sync. The caller holds a Redis lock, so duplicates are dropped. */
export async function enqueueGoogleSheetsSync(organizationId: string) {
  await getGoogleSheetsQueue().add(GOOGLE_SHEETS_JOB.syncOrg, { organizationId });
}

export async function closeGoogleSheetsQueue() {
  await queue?.close();
  queue = undefined;
}
