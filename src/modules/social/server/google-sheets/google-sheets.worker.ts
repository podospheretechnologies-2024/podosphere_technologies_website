import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { prisma } from '@/shared/lib/prisma';
import { closeGoogleSheetsQueue, getGoogleSheetsQueue, GOOGLE_SHEETS_JOB, GOOGLE_SHEETS_QUEUE_NAME } from './google-sheets.queue';
import { googleSheetsService } from './google-sheets.service';

const SYNC_EVERY_MS = 15 * 60 * 1000;

async function syncAll() {
  const connections = await prisma.socialGoogleSheetsConnection.findMany({ select: { organizationId: true } });
  for (const { organizationId } of connections) {
    try {
      await googleSheetsService.syncWithLock(organizationId);
    } catch (error) {
      console.error(`[google-sheets-worker] sync failed for ${organizationId}`, error);
    }
  }
}

function processJob(job: Job) {
  switch (job.name) {
    case GOOGLE_SHEETS_JOB.syncAll:
      return syncAll();
    case GOOGLE_SHEETS_JOB.syncOrg:
      return googleSheetsService.syncWithLock(String((job.data as { organizationId?: string }).organizationId ?? ''));
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startGoogleSheetsWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getGoogleSheetsQueue();
  await queue.upsertJobScheduler(GOOGLE_SHEETS_JOB.syncAll, { every: SYNC_EVERY_MS }, { name: GOOGLE_SHEETS_JOB.syncAll });

  const worker = new Worker(GOOGLE_SHEETS_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: 1,
  });
  worker.on('completed', (job) => console.log(`[google-sheets-worker] ${job.name} ${job.id} completed`));
  worker.on('failed', (job, error) => console.error(`[google-sheets-worker] ${job?.name} ${job?.id} failed: ${error.message}`));
  worker.on('error', (error) => console.error('[google-sheets-worker] error', error));

  return {
    async close() {
      await worker.close();
      await closeGoogleSheetsQueue();
    },
  };
}
