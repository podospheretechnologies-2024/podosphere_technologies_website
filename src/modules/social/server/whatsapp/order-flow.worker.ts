import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import {
  ORDER_FLOW_BY_KEY,
  ORDER_FLOW_MARKETING_END_HOUR_IST,
  ORDER_FLOW_MARKETING_START_HOUR_IST,
  type OrderFlowKey,
} from '../../config/order-flows';
import { sendDueOrderFlowMessage } from '../shopify/shopify-webhook.service';
import {
  closeOrderFlowQueue,
  getOrderFlowQueue,
  ORDER_FLOW_JOB,
  ORDER_FLOW_QUEUE_NAME,
} from './order-flow.queue';
import { orderFlowRepository } from './order-flow.repository';

const PROCESS_DUE_EVERY_MS = 5 * 60 * 1000;

/** Current hour (0–23) in Asia/Kolkata. */
export function istHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    }).format(now)
  );
}

/** Marketing flows (cart / review) may only send 10:00–21:00 IST. */
export function isWithinMarketingHoursIst(now = new Date()): boolean {
  const hour = istHour(now);
  return hour >= ORDER_FLOW_MARKETING_START_HOUR_IST && hour < ORDER_FLOW_MARKETING_END_HOUR_IST;
}

async function processDueMessages() {
  const due = await orderFlowRepository.findDueMessages(100);
  const marketingOk = isWithinMarketingHoursIst();

  for (const message of due) {
    const def = ORDER_FLOW_BY_KEY[message.flowKey as OrderFlowKey];
    if (def?.marketingHours && !marketingOk) {
      // Leave waiting; next tick after 10:00 IST will pick it up.
      continue;
    }
    try {
      await sendDueOrderFlowMessage(message.id);
    } catch (error) {
      console.error(`[order-flow-worker] send failed for ${message.id}`, error);
    }
  }
}

function processJob(job: Job) {
  switch (job.name) {
    case ORDER_FLOW_JOB.processDue:
      return processDueMessages();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startOrderFlowWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getOrderFlowQueue();
  await queue.upsertJobScheduler(
    ORDER_FLOW_JOB.processDue,
    { every: PROCESS_DUE_EVERY_MS },
    { name: ORDER_FLOW_JOB.processDue }
  );

  const worker = new Worker(ORDER_FLOW_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: 1,
  });
  worker.on('completed', (job) =>
    console.log(`[order-flow-worker] ${job.name} ${job.id} completed`)
  );
  worker.on('failed', (job, error) =>
    console.error(`[order-flow-worker] ${job?.name} ${job?.id} failed: ${error.message}`)
  );
  worker.on('error', (error) => console.error('[order-flow-worker] error', error));

  return {
    async close() {
      await worker.close();
      await closeOrderFlowQueue();
    },
  };
}
