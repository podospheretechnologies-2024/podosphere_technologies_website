import 'server-only';
import { Queue } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';

export const PUBLISH_QUEUE_NAME = 'social-publish';

export const PUBLISH_JOB = {
  post: 'publish-post',
  sweep: 'sweep-posts',
  refreshTokens: 'refresh-tokens',
} as const;

export const PUBLISH_JOB_ATTEMPTS = 3;

export interface PublishPostJobData {
  postId: string;
  /** Publish date the job was created for; a rescheduled post ignores older jobs. */
  publishDate: string;
}

export interface SchedulePublishJob {
  postId: string;
  publishDate: Date;
  runAt: Date;
}

const globalForQueue = globalThis as unknown as { socialPublishQueue?: Queue };

// Created on first use so importing this file (e.g. during `next build`)
// never opens a Redis connection.
export function getPublishQueue(): Queue {
  globalForQueue.socialPublishQueue ??= new Queue(PUBLISH_QUEUE_NAME, {
    connection: createQueueConnection(),
    defaultJobOptions: {
      attempts: PUBLISH_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: 60 * 1000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    },
  });
  return globalForQueue.socialPublishQueue;
}

export async function closePublishQueue(): Promise<void> {
  await globalForQueue.socialPublishQueue?.close();
  globalForQueue.socialPublishQueue = undefined;
}

export const publishQueue = {
  // The post id is the job id, so a post can only be queued once. With
  // `replace` an existing job is swapped for the new one (e.g. after a
  // reschedule) unless it is running right now; without it, posts that already
  // have a job keep it, including its retry state.
  async schedule(jobs: SchedulePublishJob[], { replace = true } = {}): Promise<void> {
    if (jobs.length === 0) {
      return;
    }

    const queue = getPublishQueue();
    if (replace) {
      await Promise.all(jobs.map((job) => queue.remove(job.postId)));
    }
    await queue.addBulk(
      jobs.map((job) => ({
        name: PUBLISH_JOB.post,
        data: {
          postId: job.postId,
          publishDate: job.publishDate.toISOString(),
        } satisfies PublishPostJobData,
        opts: { jobId: job.postId, delay: Math.max(0, job.runAt.getTime() - Date.now()) },
      }))
    );
  },
};
