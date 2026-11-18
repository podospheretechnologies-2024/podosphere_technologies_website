import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { createThread, getThread, postMessage } = vi.hoisted(() => ({
  createThread: vi.fn(),
  getThread: vi.fn(),
  postMessage: vi.fn(),
}));

vi.mock('../ai/agent/agent.service', () => ({
  agentService: {
    createThread,
    getThread,
    postMessage,
  },
}));

vi.mock('../ai/claude.client', () => ({
  isClaudeConfigured: vi.fn(() => true),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    socialAiThread: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { prisma } from '@/shared/lib/prisma';
import { portalAgentService } from './portal-agent.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

const sessionA = {
  organizationId: ORG,
  customerId: CLIENT_A,
};

const sessionB = {
  organizationId: ORG,
  customerId: CLIENT_B,
};

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

describe('portal agent tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createThread.mockResolvedValue({
      id: 'thread-a',
      organizationId: ORG,
      customerId: CLIENT_A,
      title: 'Hello',
      createdAt: '2026-11-17T00:00:00.000Z',
      updatedAt: '2026-11-17T00:00:00.000Z',
      messages: [],
      actions: [],
    });
    getThread.mockResolvedValue({
      id: 'thread-a',
      organizationId: ORG,
      customerId: CLIENT_A,
      title: 'Hello',
      createdAt: '2026-11-17T00:00:00.000Z',
      updatedAt: '2026-11-17T00:00:00.000Z',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          text: 'Hi',
          content: [],
          createdAt: '2026-11-17T00:00:00.000Z',
        },
      ],
      actions: [],
    });
    postMessage.mockResolvedValue({
      id: 'thread-a',
      organizationId: ORG,
      customerId: CLIENT_A,
      title: 'Hello',
      createdAt: '2026-11-17T00:00:00.000Z',
      updatedAt: '2026-11-17T00:01:00.000Z',
      messages: [],
      actions: [],
      configured: true,
      replyText: 'Sure',
    });
  });

  it('lists threads only for session org + client (never all-clients / null customerId)', async () => {
    await portalAgentService.listThreads(sessionA);
    expect(whereOf(db.socialAiThread.findMany)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
  });

  it('creates threads with a single-client scope from the session', async () => {
    await portalAgentService.createThread(sessionA, { title: 'Hello' });
    expect(createThread).toHaveBeenCalledWith(
      { organizationId: ORG, customerIds: [CLIENT_A] },
      { title: 'Hello', userId: null }
    );
  });

  it('loads a thread through the session client scope only', async () => {
    await portalAgentService.getThread(sessionA, 'thread-a');
    expect(getThread).toHaveBeenCalledWith(
      { organizationId: ORG, customerIds: [CLIENT_A] },
      'thread-a'
    );
  });

  it('refuses a thread whose customerId does not match the session', async () => {
    getThread.mockResolvedValueOnce({
      id: 'thread-b',
      organizationId: ORG,
      customerId: CLIENT_B,
      title: 'Secret',
      createdAt: '2026-11-17T00:00:00.000Z',
      updatedAt: '2026-11-17T00:00:00.000Z',
      messages: [],
      actions: [],
    });
    await expect(portalAgentService.getThread(sessionA, 'thread-b')).rejects.toThrow(
      /Thread not found/
    );
  });

  it('sends messages under portal-agent feature with forced client scope', async () => {
    await portalAgentService.sendMessage(sessionA, {
      threadId: 'thread-a',
      message: 'How are my posts?',
    });
    expect(getThread).toHaveBeenCalledWith(
      { organizationId: ORG, customerIds: [CLIENT_A] },
      'thread-a'
    );
    expect(postMessage).toHaveBeenCalledWith(
      { organizationId: ORG, customerIds: [CLIENT_A] },
      'thread-a',
      'How are my posts?',
      { feature: 'portal-agent' }
    );
  });

  it('client B cannot send into client A thread ids (scope mismatch path)', async () => {
    getThread.mockRejectedValueOnce(new Error('Thread not found'));
    await expect(
      portalAgentService.sendMessage(sessionB, {
        threadId: 'thread-a',
        message: 'leak?',
      })
    ).rejects.toThrow(/Thread not found/);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does not expose actions or org ids in the portal thread shape', async () => {
    const thread = await portalAgentService.getThread(sessionA, 'thread-a');
    expect(thread).toEqual({
      id: 'thread-a',
      title: 'Hello',
      createdAt: '2026-11-17T00:00:00.000Z',
      updatedAt: '2026-11-17T00:00:00.000Z',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          text: 'Hi',
          createdAt: '2026-11-17T00:00:00.000Z',
        },
      ],
    });
    expect(thread).not.toHaveProperty('actions');
    expect(thread).not.toHaveProperty('organizationId');
    expect(thread).not.toHaveProperty('customerId');
  });
});
