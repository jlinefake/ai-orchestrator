import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ElectronIpcService } from '../../services/ipc';
import { InstanceListStore } from './instance-list.store';
import { InstanceStateService } from './instance-state.service';

describe('InstanceListStore', () => {
  let store: InstanceListStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstanceListStore,
        InstanceStateService,
        { provide: ElectronIpcService, useValue: {} },
      ],
    });

    store = TestBed.inject(InstanceListStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('preserves the current model and infers gemini when provider is omitted', () => {
    const instance = store.deserializeInstance({
      id: 'instance-1',
      displayName: 'Hey Gemini',
      createdAt: 1,
      historyThreadId: 'thread-1',
      parentId: null,
      childrenIds: [],
      status: 'idle',
      contextUsage: {
        used: 0,
        total: 200000,
        percentage: 0,
      },
      lastActivity: 2,
      sessionId: 'legacy-session-1',
      workingDirectory: '/tmp/project',
      yoloMode: false,
      currentModel: 'gemini-2.5-pro',
      outputBuffer: [],
    });

    expect(instance.provider).toBe('gemini');
    expect(instance.currentModel).toBe('gemini-2.5-pro');
  });

  it('infers gemini from restore identifiers when provider and model are missing', () => {
    const instance = store.deserializeInstance({
      id: 'instance-2',
      displayName: 'Recovered thread',
      createdAt: 1,
      historyThreadId: 'gemini-restore-123',
      parentId: null,
      childrenIds: [],
      status: 'idle',
      lastActivity: 2,
      sessionId: 'gemini-session-456',
      workingDirectory: '/tmp/project',
      yoloMode: false,
      outputBuffer: [],
    });

    expect(instance.provider).toBe('gemini');
  });
});
