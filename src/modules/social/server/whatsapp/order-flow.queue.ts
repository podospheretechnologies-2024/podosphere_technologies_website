import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const ORDER_FLOW_QUEUE_NAME = 'social-order-flow-queue';

export const ORDER_FLOW_JOB = {
  /** Process due waiting messages (scheduler every 5 min). */
  processDue: 'orderFlow.processDue',
} as const;

let queue: Queue | undefined;

export function getOrderFlowQueue() {
  if (!queue) {
    queue = new Queue(ORDER_FLOW_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

export async function closeOrderFlowQueue() {
  await queue?.close();
  queue = undefined;
}
