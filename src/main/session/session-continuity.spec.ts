import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ContinuityConfig,
  SessionState,
  SessionContinuityManager,
} from './session-continuity';

const mockState = vi.hoisted(() => ({
  userDataDir: '',
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf8')),
    decryptString: vi.fn((value: Buffer) => value.toString('utf8')),
  },
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockState.userDataDir),
  },
  safeStorage: mockState.safeStorage,
}));

vi.mock('../logging/logger', () => ({
  getLogger: () => mockState.logger,
}));

vi.mock('../core/config/settings-manager', () => ({
  getSettingsManager: () => ({
    get: vi.fn(() => true),
  }),
}));

import { SessionContinuityManager as ImportedSessionContinuityManager } from './session-continuity';

type TestableSessionContinuityManager = SessionContinuityManager & {
  readyPromise: Promise<void>;
  readPayload<T>(filePath: string): Promise<T | null>;
  deserializePayload<T>(raw: string, filePath?: string): T | null;
};

function makeState(instanceId: string): SessionState {
  return {
    instanceId,
    displayName: `Session ${instanceId}`,
    agentId: 'agent-1',
    modelId: 'claude-3-5-sonnet',
    workingDirectory: '/workspace',
    conversationHistory: [
      {
        id: 'entry-1',
        role: 'user',
        content: 'hello',
        timestamp: Date.now(),
      },
    ],
    contextUsage: {
      used: 123,
      total: 200000,
    },
    pendingTasks: [],
    environmentVariables: {},
    activeFiles: [],
    skillsLoaded: [],
    hooksActive: [],
  };
}

function createEnvelope(data: unknown): string {
  return JSON.stringify({
    encrypted: false,
    data: JSON.stringify(data),
  });
}

function getLogCall(calls: unknown[][], message: string): unknown[] | undefined {
  return calls.find(([entry]) => entry === message);
}

describe('SessionContinuityManager logging', () => {
  const tempDirs: string[] = [];
  const managers: SessionContinuityManager[] = [];

  function createManager(config: Partial<ContinuityConfig> = {}): TestableSessionContinuityManager {
    const manager = new ImportedSessionContinuityManager({
      autoSaveEnabled: false,
      ...config,
    }) as unknown as TestableSessionContinuityManager;
    managers.push(manager as unknown as SessionContinuityManager);
    return manager;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    mockState.safeStorage.isEncryptionAvailable.mockReturnValue(false);
    mockState.safeStorage.decryptString.mockImplementation((value: Buffer) => value.toString('utf8'));
    mockState.userDataDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'session-continuity-')
    );
    tempDirs.push(mockState.userDataDir);
  });

  afterEach(async () => {
    for (const manager of managers.splice(0, managers.length)) {
      manager.shutdown();
    }

    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });

  it('logs per-file load counts and skipped state files during startup', async () => {
    const stateDir = path.join(mockState.userDataDir, 'session-continuity', 'states');
    await fs.promises.mkdir(stateDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(stateDir, 'good.json'),
      createEnvelope(makeState('good-session'))
    );
    await fs.promises.writeFile(path.join(stateDir, 'bad.json'), '{bad json');

    const manager = createManager();
    await manager.readyPromise;

    const sessions = await manager.getResumableSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.instanceId).toBe('good-session');

    expect(mockState.logger.warn.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'Skipped unloadable session state file',
          expect.objectContaining({
            file: 'bad.json',
            filePath: path.join(stateDir, 'bad.json'),
          }),
        ],
      ])
    );
    expect(mockState.logger.info.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'Session states loaded',
          expect.objectContaining({ loaded: 1, failed: 1, total: 2 }),
        ],
      ])
    );
  });

  it('logs non-ENOENT read failures from readPayload', async () => {
    const manager = createManager();
    await manager.readyPromise;

    const readFileSpy = vi
      .spyOn(fs.promises, 'readFile')
      .mockRejectedValueOnce(Object.assign(new Error('permission denied'), { code: 'EACCES' }));

    const result = await manager.readPayload('/tmp/blocked.json');

    expect(result).toBeNull();
    const errorCall = getLogCall(mockState.logger.error.mock.calls, 'Failed to read continuity file');
    expect(errorCall).toBeDefined();
    expect(errorCall?.[1]).toBeInstanceOf(Error);
    expect(errorCall?.[2]).toEqual(
      expect.objectContaining({
        path: '/tmp/blocked.json',
        errorCode: 'EACCES',
      })
    );

    readFileSpy.mockRestore();
  });

  it('logs invalid outer JSON with preview metadata', async () => {
    const manager = createManager();
    await manager.readyPromise;

    const result = manager.deserializePayload('{"broken"', '/tmp/invalid.json');

    expect(result).toBeNull();
    const errorCall = getLogCall(mockState.logger.error.mock.calls, 'Session file contains invalid JSON');
    expect(errorCall).toBeDefined();
    expect(errorCall?.[1]).toBeInstanceOf(Error);
    expect(errorCall?.[2]).toEqual(
      expect.objectContaining({
        filePath: '/tmp/invalid.json',
        rawLength: 9,
        rawPreview: '{"broken"',
      })
    );
  });

  it('logs decrypt failures with envelope metadata', async () => {
    const manager = createManager({
      encryptOnDisk: true,
    });
    await manager.readyPromise;
    mockState.safeStorage.decryptString.mockImplementationOnce(() => {
      throw new Error('decrypt failed');
    });

    const result = manager.deserializePayload(
      JSON.stringify({
        encrypted: true,
        data: Buffer.from('ciphertext', 'utf8').toString('base64'),
      }),
      '/tmp/encrypted.json'
    );

    expect(result).toBeNull();
    const errorCall = getLogCall(
      mockState.logger.error.mock.calls,
      'Failed to decrypt/parse session payload'
    );
    expect(errorCall).toBeDefined();
    expect(errorCall?.[1]).toBeInstanceOf(Error);
    expect(errorCall?.[2]).toEqual(
      expect.objectContaining({
        filePath: '/tmp/encrypted.json',
        encrypted: true,
        dataType: 'string',
      })
    );
  });
});
