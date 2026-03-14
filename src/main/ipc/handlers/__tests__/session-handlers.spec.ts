/**
 * Tests for session/history IPC handlers.
 *
 * Strategy: mock `electron` to capture ipcMain.handle registrations, then
 * invoke the captured handlers directly to verify restore behavior without
 * launching an Electron process.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcResponse } from '../../../../shared/types/ipc.types';
import type { InstanceManager } from '../../../instance/instance-manager';

type IpcHandler = (event: unknown, payload?: unknown) => Promise<unknown>;
const handlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }),
  },
  dialog: {
    showSaveDialog: vi.fn(),
  },
  clipboard: {
    writeText: vi.fn(),
  },
  shell: {
    showItemInFolder: vi.fn(),
  },
}));

vi.mock('../../../logging/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockLoadConversation = vi.fn();

vi.mock('../../../history', () => ({
  getHistoryManager: () => ({
    getEntries: vi.fn().mockReturnValue([]),
    loadConversation: mockLoadConversation,
    deleteEntry: vi.fn(),
    archiveEntry: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

vi.mock('../../../session/session-archive', () => ({
  getSessionArchiveManager: () => ({
    archiveSession: vi.fn(),
    listArchivedSessions: vi.fn().mockReturnValue([]),
    restoreSession: vi.fn(),
    deleteArchivedSession: vi.fn(),
    getArchivedSessionMeta: vi.fn(),
    updateTags: vi.fn(),
    getArchiveStats: vi.fn(),
    cleanupOldArchives: vi.fn(),
  }),
}));

vi.mock('../../../session/session-share-service', () => ({
  getSessionShareService: () => ({
    createBundle: vi.fn(),
    saveBundle: vi.fn(),
    loadBundle: vi.fn(),
    toExportedSession: vi.fn(),
  }),
}));

vi.mock('../../../session/session-continuity', () => ({
  getSessionContinuityManager: () => ({
    getResumableSessions: vi.fn().mockReturnValue([]),
    resumeSession: vi.fn(),
    listSnapshots: vi.fn().mockReturnValue([]),
    createSnapshot: vi.fn(),
    getStats: vi.fn(),
  }),
}));

import { registerSessionHandlers } from '../session-handlers';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';

async function invoke(
  channel: string,
  payload?: unknown
): Promise<IpcResponse<Record<string, unknown>>> {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }

  return handler({}, payload) as Promise<IpcResponse<Record<string, unknown>>>;
}

function makeMockInstanceManager(): InstanceManager {
  return {
    createInstance: vi.fn(),
    getInstance: vi.fn(),
    terminateInstance: vi.fn(),
  } as unknown as InstanceManager;
}

describe('session-handlers', () => {
  let mockInstanceManager: InstanceManager;

  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();

    mockInstanceManager = makeMockInstanceManager();

    registerSessionHandlers({
      instanceManager: mockInstanceManager,
      serializeInstance: vi.fn((instance: unknown) => instance as Record<string, unknown>),
    });
  });

  describe('HISTORY_RESTORE', () => {
    it('keeps the inferred provider when a legacy thread falls back to a fresh instance', async () => {
      mockLoadConversation.mockResolvedValue({
        entry: {
          id: 'entry-1',
          displayName: 'Legacy thread',
          createdAt: Date.now() - 10_000,
          endedAt: Date.now(),
          workingDirectory: '/tmp/project',
          messageCount: 1,
          firstUserMessage: 'Hey Gemini!',
          lastUserMessage: 'What model are you?',
          status: 'completed',
          originalInstanceId: 'instance-1',
          parentId: null,
          sessionId: 'legacy-session-1',
        },
        messages: [],
      });

      const resumeInstance = {
        id: 'resume-1',
        outputBuffer: [],
      };
      const fallbackInstance = {
        id: 'fallback-1',
        outputBuffer: [],
      };

      vi.mocked(mockInstanceManager.createInstance)
        .mockResolvedValueOnce(
          resumeInstance as unknown as Awaited<ReturnType<typeof mockInstanceManager.createInstance>>
        )
        .mockResolvedValueOnce(
          fallbackInstance as unknown as Awaited<ReturnType<typeof mockInstanceManager.createInstance>>
        );

      vi.mocked(mockInstanceManager.getInstance).mockReturnValue({
        id: 'resume-1',
        status: 'error',
        outputBuffer: [],
      } as unknown as ReturnType<typeof mockInstanceManager.getInstance>);

      vi.mocked(mockInstanceManager.terminateInstance).mockResolvedValue(undefined);

      const result = await invoke(IPC_CHANNELS.HISTORY_RESTORE, {
        entryId: 'entry-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        instanceId: 'fallback-1',
        restoreMode: 'replay-fallback',
      });

      expect(mockInstanceManager.createInstance).toHaveBeenCalledTimes(2);
      expect(vi.mocked(mockInstanceManager.createInstance).mock.calls[0][0]).toMatchObject({
        provider: 'gemini',
        resume: true,
      });
      expect(vi.mocked(mockInstanceManager.createInstance).mock.calls[1][0]).toMatchObject({
        provider: 'gemini',
      });
      expect(fallbackInstance.outputBuffer.at(-1)).toMatchObject({
        type: 'system',
        content: expect.stringContaining('Previous Gemini CLI session could not be restored.'),
      });
    });
  });
});
