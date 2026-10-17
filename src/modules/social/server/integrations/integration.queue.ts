import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const INTEGRATION_QUEUE_NAME = 'social-integration-queue';

export const INTEGRATION_JOB = {
  /** Hard-delete one SocialIntegration and related rows (channel remove). */
  deleteData: 'integration.data.delete',
  /** Process a DataDeletionRequest (Meta callback or web form) and mark it completed. */
  processDeletionRequest: 'integration.deletion.request',
};

let queue: Queue | undefined;

export function getIntegrationQueue() {
  if (!queue) {
    queue = new Queue(INTEGRATION_QUEUE_NAME, {
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

export async function closeIntegrationQueue() {
  await queue?.close();
  queue = undefined;
}
