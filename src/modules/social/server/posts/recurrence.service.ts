import 'server-only';
import type { SocialRecurrenceRule } from '@/generated/prisma/client';
import { organizationScope } from '@/shared/server/client-scope';
import {
  EVERGREEN_MIN_GAP_DAYS,
  type RecurrenceRule,
} from '../../config/posts';
import type { PostRecurrence } from '../../types/post';
import { publishQueue } from '../publishing/publish.queue';
import { postRepository } from './post.repository';
import { recurrenceRepository, type UpsertRecurrenceData } from './recurrence.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

const RULE_TO_DB: Record<RecurrenceRule, SocialRecurrenceRule> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
};

const RULE_FROM_DB: Record<SocialRecurrenceRule, RecurrenceRule> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

export function toPostRecurrence(
  row: {
    rule: SocialRecurrenceRule;
    until: Date | null;
    maxRuns: number | null;
    evergreen: boolean;
    runCount: number;
    active: boolean;
  } | null
): PostRecurrence | null {
  if (!row || !row.active) {
    return null;
  }
  return {
    rule: RULE_FROM_DB[row.rule],
    until: row.until?.toISOString() ?? null,
    maxRuns: row.maxRuns,
    evergreen: row.evergreen,
    runCount: row.runCount,
  };
}

export function addRecurrenceInterval(from: Date, rule: SocialRecurrenceRule): Date {
  const next = new Date(from.getTime());
  switch (rule) {
    case 'DAILY':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }
  return next;
}

function toUpsertData(
  organizationId: string,
  group: string,
  recurrence: {
    rule: RecurrenceRule;
    until?: string | null;
    maxRuns?: number | null;
    evergreen?: boolean;
  }
): UpsertRecurrenceData {
  return {
    organizationId,
    group,
    rule: RULE_TO_DB[recurrence.rule],
    until: recurrence.until ? new Date(recurrence.until) : null,
    maxRuns: recurrence.maxRuns ?? null,
    evergreen: recurrence.evergreen ?? false,
  };
}

async function nextEvergreenSlot(
  organizationId: string,
  integrationIds: string[],
  notBefore: Date
): Promise<Date> {
  const gapStart = new Date(notBefore.getTime() + EVERGREEN_MIN_GAP_DAYS * DAY_MS);
  const end = new Date(gapStart.getTime() + 60 * DAY_MS);
  const taken = new Set(
    (await postRepository.findTakenDates(organizationId, integrationIds, gapStart, end)).map(
      (date) => date.getTime()
    )
  );

  let candidate = gapStart.getTime();
  while (candidate < end.getTime()) {
    if (!taken.has(candidate)) {
      return new Date(candidate);
    }
    candidate += DAY_MS;
  }
  return end;
}

export const recurrenceService = {
  async getForGroup(group: string): Promise<PostRecurrence | null> {
    return toPostRecurrence(await recurrenceRepository.findByGroup(group));
  },

  async saveForGroup(
    organizationId: string,
    group: string,
    recurrence:
      | {
          rule: RecurrenceRule;
          until?: string | null;
          maxRuns?: number | null;
          evergreen?: boolean;
        }
      | null
      | undefined
  ): Promise<void> {
    // undefined = caller did not touch recurrence (e.g. older API clients).
    if (recurrence === undefined) {
      return;
    }
    if (recurrence === null) {
      await recurrenceRepository.deleteForGroup(group);
      return;
    }
    await recurrenceRepository.upsertForGroup(toUpsertData(organizationId, group, recurrence));
  },

  async deactivateForGroup(group: string): Promise<void> {
    await recurrenceRepository.deactivateForGroup(group);
  },

  /**
   * Called after a root post publishes. When every channel in the group has
   * published, clones the group for the next run and queues it.
   */
  async afterGroupPublished(organizationId: string, group: string): Promise<string | null> {
    const recurrence = await recurrenceRepository.findByGroup(group);
    if (!recurrence?.active) {
      return null;
    }

    const roots = await postRepository.findGroup(organizationScope(organizationId), group);
    const rootRows = roots.filter((row) => !row.parentPostId);
    if (rootRows.length === 0 || rootRows.some((row) => row.state !== 'PUBLISHED')) {
      return null;
    }

    const baseDate = rootRows[0].publishDate;
    let nextDate = addRecurrenceInterval(baseDate, recurrence.rule);

    if (recurrence.evergreen) {
      const integrationIds = [...new Set(rootRows.map((row) => row.integrationId))];
      nextDate = await nextEvergreenSlot(organizationId, integrationIds, baseDate);
    }

    const newGroup = await recurrenceRepository.cloneGroupAfterPublish({
      organizationId,
      sourceGroup: group,
      publishDate: nextDate,
    });
    if (!newGroup) {
      return null;
    }

    const cloned = await postRepository.findGroup(organizationScope(organizationId), newGroup);
    const jobs = cloned
      .filter((row) => !row.parentPostId && row.state === 'QUEUE')
      .map((row) => ({
        postId: row.id,
        publishDate: row.publishDate,
        runAt: row.publishDate,
      }));

    try {
      await publishQueue.schedule(jobs);
    } catch (error) {
      console.error(`[social] could not queue recurrence clone ${newGroup}`, error);
    }

    return newGroup;
  },
};
