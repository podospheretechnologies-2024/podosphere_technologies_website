/** Task state machine: todo → review → done; review → todo (sent back); done → todo (reopen). */
export type TaskStatus = 'todo' | 'review' | 'done';
export type TaskAction = 'complete' | 'approve' | 'send_back' | 'reopen';

const TRANSITIONS: Record<TaskAction, Partial<Record<TaskStatus, TaskStatus>>> = {
  complete: { todo: 'review' },
  approve: { review: 'done', todo: 'done' },
  send_back: { review: 'todo' },
  reopen: { done: 'todo', review: 'todo' },
};

export function nextTaskState(current: string, action: TaskAction): TaskStatus | null {
  return TRANSITIONS[action][current as TaskStatus] ?? null;
}
