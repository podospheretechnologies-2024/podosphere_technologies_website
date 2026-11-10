import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { SocialTask } from '@/generated/prisma/client';
import { nextTaskState, type TaskAction } from './task-transitions';

export const TASK_AREAS = ['ads', 'website', 'content', 'smm', 'seo', 'design', 'video', 'other'] as const;
export const TASK_PRIORITIES = ['high', 'med', 'low'] as const;
export type TaskArea = (typeof TASK_AREAS)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface TaskDto {
  id: string;
  title: string;
  detail: string | null;
  area: string;
  priority: string;
  status: string;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  link: string | null;
  source: string;
  doneNote: string | null;
  doneAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

function toDto(task: SocialTask, names: Map<string, string>): TaskDto {
  return {
    id: task.id,
    title: task.title,
    detail: task.detail,
    area: task.area,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
    assigneeId: task.assigneeId,
    assigneeName: task.assigneeId ? (names.get(task.assigneeId) ?? null) : null,
    link: task.link,
    source: task.source,
    doneNote: task.doneNote,
    doneAt: task.doneAt?.toISOString() ?? null,
    reviewNote: task.reviewNote,
    reviewedAt: task.reviewedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
  };
}

async function userNames(organizationId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (!unique.length) return new Map();
  const users = await prisma.user.findMany({
    where: { organizationId, id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.name || u.email]));
}

export interface TaskInput {
  title: string;
  detail?: string | null;
  area?: TaskArea;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
  link?: string | null;
}

async function assertAssignee(organizationId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const user = await prisma.user.findFirst({ where: { id: assigneeId, organizationId, deletedAt: null }, select: { id: true } });
  if (!user) throw new HttpError(400, 'That person is not in this workspace.');
}

export const tasksService = {
  async list(organizationId: string, customerId: string): Promise<TaskDto[]> {
    const rows = await prisma.socialTask.findMany({
      where: { organizationId, customerId },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
    const names = await userNames(organizationId, rows.map((r) => r.assigneeId));
    return rows.map((r) => toDto(r, names));
  },

  async create(
    organizationId: string,
    customerId: string,
    input: TaskInput & { source?: string; sourceRef?: string | null },
    createdById: string | null
  ): Promise<TaskDto> {
    await assertAssignee(organizationId, input.assigneeId);
    const row = await prisma.socialTask.create({
      data: {
        organizationId,
        customerId,
        title: input.title.slice(0, 255),
        detail: input.detail ?? null,
        area: input.area ?? 'ads',
        priority: input.priority ?? 'med',
        dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
        assigneeId: input.assigneeId ?? null,
        link: input.link ?? null,
        source: input.source ?? 'manual',
        sourceRef: input.sourceRef ?? null,
        createdById,
      },
    });
    const names = await userNames(organizationId, [row.assigneeId]);
    return toDto(row, names);
  },

  /** Idempotent generated task: creates it once per sourceRef; re-opens nothing that a person closed. */
  async ensureGenerated(
    organizationId: string,
    customerId: string,
    sourceRef: string,
    input: TaskInput & { source: string }
  ): Promise<boolean> {
    const existing = await prisma.socialTask.findUnique({
      where: { customerId_sourceRef: { customerId, sourceRef } },
      select: { id: true },
    });
    if (existing) return false;
    try {
      await this.create(organizationId, customerId, { ...input, sourceRef }, null);
      return true;
    } catch (error) {
      // Unique race with another worker run: fine.
      if (error instanceof Error && /Unique constraint/i.test(error.message)) return false;
      throw error;
    }
  },

  /** Closes a generated task that is still open (e.g. the post moved on). */
  async closeGenerated(customerId: string, sourceRef: string, note: string): Promise<void> {
    const now = new Date();
    await prisma.socialTask.updateMany({
      where: { customerId, sourceRef, status: { in: ['todo', 'review'] } },
      data: { status: 'done', doneNote: note, doneAt: now, reviewedAt: now },
    });
  },

  async update(
    organizationId: string,
    customerId: string,
    taskId: string,
    change: { action?: TaskAction; note?: string | null } & Partial<TaskInput>,
    userId: string,
    canReview: boolean
  ): Promise<TaskDto> {
    const task = await prisma.socialTask.findFirst({ where: { id: taskId, organizationId, customerId } });
    if (!task) throw new HttpError(404, 'Not found');

    const data: Record<string, unknown> = {};
    if (change.action) {
      if ((change.action === 'approve' || change.action === 'send_back') && !canReview) {
        throw new HttpError(403, 'Only reviewers can approve or send back tasks.');
      }
      const next = nextTaskState(task.status, change.action);
      if (!next) throw new HttpError(409, `This task cannot be ${change.action.replace('_', ' ')} from "${task.status}".`);
      const now = new Date();
      data.status = next;
      if (change.action === 'complete') Object.assign(data, { doneNote: change.note ?? null, doneAt: now, doneById: userId });
      if (change.action === 'approve') Object.assign(data, { reviewedAt: now, reviewedById: userId });
      if (change.action === 'send_back')
        Object.assign(data, { reviewNote: change.note || 'Please redo', reviewedAt: now, reviewedById: userId });
      if (change.action === 'reopen') Object.assign(data, { doneAt: null, reviewedAt: null });
    }
    if (change.title !== undefined) data.title = change.title.slice(0, 255);
    if (change.detail !== undefined) data.detail = change.detail;
    if (change.area !== undefined) data.area = change.area;
    if (change.priority !== undefined) data.priority = change.priority;
    if (change.link !== undefined) data.link = change.link;
    if (change.dueDate !== undefined) data.dueDate = change.dueDate ? new Date(`${change.dueDate}T00:00:00.000Z`) : null;
    if (change.assigneeId !== undefined) {
      await assertAssignee(organizationId, change.assigneeId);
      data.assigneeId = change.assigneeId;
    }
    const row = await prisma.socialTask.update({ where: { id: task.id }, data });
    const names = await userNames(organizationId, [row.assigneeId]);
    return toDto(row, names);
  },

  async remove(organizationId: string, customerId: string, taskId: string): Promise<void> {
    const res = await prisma.socialTask.deleteMany({ where: { id: taskId, organizationId, customerId } });
    if (!res.count) throw new HttpError(404, 'Not found');
  },

  async assignees(organizationId: string) {
    const users = await prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => ({ id: u.id, name: u.name || u.email }));
  },
};
