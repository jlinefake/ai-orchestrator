import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliAdapter } from '../cli/adapters/adapter-factory';
import type { Instance } from '../../shared/types/instance.types';
import type { SessionDiffTracker } from './session-diff-tracker';

vi.mock('../core/config/settings-manager', () => ({
  getSettingsManager: () => ({
    getAll: () => ({
      outputBufferSize: 100,
      enableDiskStorage: false,
    }),
  }),
}));

vi.mock('../memory', () => ({
  getOutputStorageManager: () => ({
    storeMessages: vi.fn(),
    deleteInstance: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../hooks/hook-manager', () => ({
  getHookManager: () => ({
    triggerHooks: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../core/error-recovery', () => ({
  getErrorRecoveryManager: () => ({
    classifyError: vi.fn(() => ({ category: 'unknown', technicalDetails: '' })),
  }),
}));

import { InstanceCommunicationManager } from './instance-communication';

class FakeAdapter extends EventEmitter {
  constructor(private readonly adapterName: string) {
    super();
  }

  getName(): string {
    return this.adapterName;
  }

  getSessionId(): string | null {
    return null;
  }

  removeAllListeners(): this {
    return super.removeAllListeners();
  }
}

function createInstance(status: Instance['status'] = 'idle'): Instance {
  return {
    id: 'instance-1',
    displayName: 'Test Instance',
    createdAt: Date.now(),
    historyThreadId: 'thread-1',
    parentId: null,
    childrenIds: [],
    supervisorNodeId: '',
    workerNodeId: undefined,
    depth: 0,
    terminationPolicy: 'terminate-children',
    contextInheritance: {} as Instance['contextInheritance'],
    agentId: 'build',
    agentMode: 'build',
    planMode: {
      enabled: false,
      state: 'off',
    },
    status,
    contextUsage: {
      used: 0,
      total: 200000,
      percentage: 0,
    },
    lastActivity: Date.now(),
    processId: 12345,
    sessionId: 'session-1',
    workingDirectory: '/tmp/project',
    yoloMode: false,
    provider: 'claude',
    currentModel: undefined,
    outputBuffer: [],
    outputBufferMaxSize: 1000,
    communicationTokens: new Map(),
    subscribedTo: [],
    totalTokensUsed: 0,
    requestCount: 0,
    errorCount: 0,
    restartCount: 0,
  };
}

describe('InstanceCommunicationManager', () => {
  let instance: Instance;
  let adapters: Map<string, CliAdapter>;
  let queueUpdate: ReturnType<typeof vi.fn>;
  let manager: InstanceCommunicationManager;

  async function flushOutputHandlers(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    instance = createInstance();
    adapters = new Map();
    queueUpdate = vi.fn();

    manager = new InstanceCommunicationManager({
      getInstance: (id) => (id === instance.id ? instance : undefined),
      getAdapter: (id) => adapters.get(id),
      setAdapter: (id, adapter) => {
        adapters.set(id, adapter);
      },
      deleteAdapter: (id) => adapters.delete(id),
      queueUpdate,
      processOrchestrationOutput: vi.fn(),
      onInterruptedExit: vi.fn().mockResolvedValue(undefined),
      ingestToRLM: vi.fn(),
      ingestToUnifiedMemory: vi.fn(),
    });
  });

  it('ignores normal exit events from stateless exec adapters like codex', () => {
    const adapter = new FakeAdapter('codex-cli') as unknown as CliAdapter;
    adapters.set(instance.id, adapter);

    manager.setupAdapterEvents(instance.id, adapter);
    (adapter as unknown as EventEmitter).emit('exit', 0, null);

    expect(instance.status).toBe('idle');
    expect(instance.processId).toBe(12345);
    expect(queueUpdate).not.toHaveBeenCalled();
  });

  it('still marks persistent adapters as terminated on exit', () => {
    const adapter = new FakeAdapter('claude-cli') as unknown as CliAdapter;
    adapters.set(instance.id, adapter);

    manager.setupAdapterEvents(instance.id, adapter);
    (adapter as unknown as EventEmitter).emit('exit', 0, null);

    expect(instance.status).toBe('terminated');
    expect(instance.processId).toBeNull();
    expect(queueUpdate).toHaveBeenCalledWith(instance.id, 'terminated');
  });

  it('captures baselines from tool_result messages', async () => {
    const captureBaseline = vi.fn();
    const tracker = {
      captureBaseline,
      computeDiff: vi.fn(),
    } as unknown as SessionDiffTracker;
    const adapter = new FakeAdapter('claude-cli') as unknown as CliAdapter;
    adapters.set(instance.id, adapter);

    manager = new InstanceCommunicationManager({
      getInstance: (id) => (id === instance.id ? instance : undefined),
      getAdapter: (id) => adapters.get(id),
      setAdapter: (id, currentAdapter) => {
        adapters.set(id, currentAdapter);
      },
      deleteAdapter: (id) => adapters.delete(id),
      queueUpdate,
      getDiffTracker: () => tracker,
      processOrchestrationOutput: vi.fn(),
      onInterruptedExit: vi.fn().mockResolvedValue(undefined),
      ingestToRLM: vi.fn(),
      ingestToUnifiedMemory: vi.fn(),
    });

    manager.setupAdapterEvents(instance.id, adapter);
    (adapter as unknown as EventEmitter).emit('output', {
      id: 'tool-result-1',
      timestamp: Date.now(),
      type: 'tool_result',
      content: '',
      metadata: {
        name: 'Write',
        input: {
          file_path: '/tmp/project/src/main.ts',
          content: 'updated',
        },
      },
    });
    await flushOutputHandlers();

    expect(captureBaseline).toHaveBeenCalledWith('/tmp/project/src/main.ts');
  });

  it('stores diffStats on busy to idle transitions', () => {
    const diffStats = {
      totalAdded: 8,
      totalDeleted: 3,
      files: {
        'src/main.ts': {
          path: 'src/main.ts',
          status: 'modified' as const,
          added: 8,
          deleted: 3,
        },
      },
    };
    const tracker = {
      captureBaseline: vi.fn(),
      computeDiff: vi.fn(() => diffStats),
    } as unknown as SessionDiffTracker;
    const adapter = new FakeAdapter('claude-cli') as unknown as CliAdapter;
    adapters.set(instance.id, adapter);
    instance.status = 'busy';

    manager = new InstanceCommunicationManager({
      getInstance: (id) => (id === instance.id ? instance : undefined),
      getAdapter: (id) => adapters.get(id),
      setAdapter: (id, currentAdapter) => {
        adapters.set(id, currentAdapter);
      },
      deleteAdapter: (id) => adapters.delete(id),
      queueUpdate,
      getDiffTracker: () => tracker,
      processOrchestrationOutput: vi.fn(),
      onInterruptedExit: vi.fn().mockResolvedValue(undefined),
      ingestToRLM: vi.fn(),
      ingestToUnifiedMemory: vi.fn(),
    });

    manager.setupAdapterEvents(instance.id, adapter);
    (adapter as unknown as EventEmitter).emit('status', 'idle');

    expect(instance.diffStats).toEqual(diffStats);
    expect(queueUpdate).toHaveBeenCalledWith(instance.id, 'idle', instance.contextUsage, diffStats);
  });
});
