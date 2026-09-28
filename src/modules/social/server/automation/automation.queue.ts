import 'server-only';
import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const AUTOMATION_QUEUE_NAME = 'social-automation';

export const AUTOMATION_JOB = {
  sendWebhook: 'send-webhook',
  autopostSweep: 'autopost-sweep',
  runAutopost: 'run-autopost',
} as const;

export const AUTOMATION_JOB_ATTEMPTS = 3;

export interface SendWebhookJobData {
  webhookId: string;
  postId: string;
}

export interface RunAutopostJobData {
  autopostId: string;
}

const globalForQueue = globalThis as unknown as { socialAutomationQueue?: Queue };

// Created on first use, like the publish queue, so `next build` never connects to Redis.
export function getAutomationQueue(): Queue {
  globalForQueue.socialAutomationQueue ??= new Queue(AUTOMATION_QUEUE_NAME, {
    connection: createQueueConnection(),
    defaultJobOptions: {
      attempts: AUTOMATION_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: 30 * 1000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    },
  });
  return globalForQueue.socialAutomationQueue;
}

export async function closeAutomationQueue(): Promise<void> {
  await globalForQueue.socialAutomationQueue?.close();
  globalForQueue.socialAutomationQueue = undefined;
}

export const automationQueue = {
  // Job ids cannot contain ":", hence the "_" separator.
  async sendWebhooks(webhookIds: string[], postId: string): Promise<void> {
    if (webhookIds.length === 0) {
      return;
    }
    await getAutomationQueue().addBulk(
      webhookIds.map((webhookId) => ({
        name: AUTOMATION_JOB.sendWebhook,
        data: { webhookId, postId } satisfies SendWebhookJobData,
        opts: { jobId: `webhook_${webhookId}_${postId}` },
      }))
    );
  },

  async runAutoposts(autopostIds: string[]): Promise<void> {
    if (autopostIds.length === 0) {
      return;
    }
    await getAutomationQueue().addBulk(
      autopostIds.map((autopostId) => ({
        name: AUTOMATION_JOB.runAutopost,
        data: { autopostId } satisfies RunAutopostJobData,
        // One check per feed at a time; the sweep adds it again next round.
        opts: {
          jobId: `autopost_${autopostId}`,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      }))
    );
  },
};
