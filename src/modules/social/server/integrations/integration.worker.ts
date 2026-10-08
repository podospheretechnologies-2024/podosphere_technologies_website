import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getIntegrationQueue, closeIntegrationQueue, INTEGRATION_JOB, INTEGRATION_QUEUE_NAME } from './integration.queue';
import { prisma } from '@/shared/lib/prisma';

async function processDataDeletion(integrationId: string) {
  console.log(`[integration-worker] Deleting data for integration ${integrationId}...`);
  // Hard delete to fulfill Meta data deletion requirements
  await prisma.$transaction([
    prisma.socialPostError.deleteMany({ where: { post: { integrationId } } }),
    prisma.socialTagsOnPosts.deleteMany({ where: { post: { integrationId } } }),
    prisma.socialPost.deleteMany({ where: { integrationId } }),
    prisma.socialExternalPost.deleteMany({ where: { integrationId } }),
    prisma.socialInsightDaily.deleteMany({ where: { integrationId } }),
    prisma.socialSyncState.deleteMany({ where: { integrationId } }),
    prisma.socialWebhookIntegration.deleteMany({ where: { integrationId } }),
    prisma.socialIntegration.deleteMany({ where: { id: integrationId } }),
  ]);
  console.log(`[integration-worker] Data deletion complete for ${integrationId}`);
}

function processJob(job: Job) {
  switch (job.name) {
    case INTEGRATION_JOB.deleteData:
      return processDataDeletion(job.data.integrationId);
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startIntegrationWorker(): Promise<{ close(): Promise<void> }> {
  const worker = new Worker(INTEGRATION_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: 1,
  });

  worker.on('failed', (job, error) => {
    console.error(`[integration-worker] ${job?.name} failed: ${error.message}`);
  });

  return {
    async close() {
      await worker.close();
      await closeIntegrationQueue();
    },
  };
}
