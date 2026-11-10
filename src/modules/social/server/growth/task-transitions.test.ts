import { describe, expect, it } from 'vitest';
import { nextTaskState } from './task-transitions';

describe('nextTaskState', () => {
  it('moves a finished task to review, then done', () => {
    expect(nextTaskState('todo', 'complete')).toBe('review');
    expect(nextTaskState('review', 'approve')).toBe('done');
  });
  it('sends a reviewed task back to todo', () => {
    expect(nextTaskState('review', 'send_back')).toBe('todo');
  });
  it('rejects invalid moves', () => {
    expect(nextTaskState('done', 'complete')).toBeNull();
    expect(nextTaskState('todo', 'send_back')).toBeNull();
    expect(nextTaskState('weird', 'approve')).toBeNull();
  });
  it('lets a reviewer close a task directly and reopen it', () => {
    expect(nextTaskState('todo', 'approve')).toBe('done');
    expect(nextTaskState('done', 'reopen')).toBe('todo');
  });
});
