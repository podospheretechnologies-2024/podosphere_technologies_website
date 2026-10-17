import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import {
  getIntegrationQueue,
  closeIntegrationQueue,
  INTEGRATION_JOB,
  INTEGRATION_QUEUE_NAME,
} from './integration.queue';
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

async function findIntegrationsForDeletionRequest(request: {
  metaUserId: string | null;
  email: string | null;
}): Promise<string[]> {
  const ids = new Set<string>();

  if (request.metaUserId) {
    const byMeta = await prisma.socialIntegration.findMany({
      where: {
        providerIdentifier: { in: ['facebook', 'instagram'] },
        additionalSettings: { path: '$.metaUserId', equals: request.metaUserId },
      },
      select: { id: true },
    });
    for (const row of byMeta) {
      ids.add(row.id);
    }
  }

  if (request.email) {
    const user = await prisma.user.findFirst({
      where: { email: request.email, deletedAt: null },
      select: { organizationId: true },
    });
    if (user) {
      const byEmail = await prisma.socialIntegration.findMany({
        where: {
          organizationId: user.organizationId,
          providerIdentifier: { in: ['facebook', 'instagram'] },
        },
        select: { id: true },
      });
      for (const row of byEmail) {
        ids.add(row.id);
      }
    }
  }

  return [...ids];
}

async function processDeletionRequest(confirmationCode: string) {
  const request = await prisma.dataDeletionRequest.findUnique({
    where: { confirmationCode },
  });
  if (!request) {
    console.warn(`[integration-worker] No DataDeletionRequest for code ${confirmationCode}`);
    return { ok: false, reason: 'not_found' };
  }

  await prisma.dataDeletionRequest.update({
    where: { id: request.id },
    data: { status: 'processing' },
  });

  const integrationIds = await findIntegrationsForDeletionRequest(request);
  for (const integrationId of integrationIds) {
    await processDataDeletion(integrationId);
  }

  await prisma.dataDeletionRequest.update({
    where: { id: request.id },
    data: { status: 'completed', completedAt: new Date() },
  });

  console.log(
    `[integration-worker] DataDeletionRequest ${confirmationCode} completed (${integrationIds.length} integrations)`
  );
  return { ok: true, deleted: integrationIds.length };
}

function processJob(job: Job) {
  switch (job.name) {
    case INTEGRATION_JOB.deleteData:
      return processDataDeletion(job.data.integrationId);
    case INTEGRATION_JOB.processDeletionRequest:
      return processDeletionRequest(job.data.confirmationCode);
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
