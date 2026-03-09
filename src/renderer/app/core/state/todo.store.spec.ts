import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoStore } from './todo.store';
import { TodoIpcService } from '../services/ipc';
import type { TodoItem, TodoList } from '../../../../shared/types/todo.types';

function createTodoList(sessionId: string, content: string): TodoList {
  const item: TodoItem = {
    id: `todo-${sessionId}`,
    content,
    status: 'pending',
    sessionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    sessionId,
    items: [item],
    stats: {
      total: 1,
      pending: 1,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      percentComplete: 0,
    },
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('TodoStore', () => {
  let store: TodoStore;
  const loadPromises = new Map<string, ReturnType<typeof deferred<{ success: true; data: TodoList }>>>();

  const ipcMock = {
    todoGetList: vi.fn((sessionId: string) => {
      const pending = deferred<{ success: true; data: TodoList }>();
      loadPromises.set(sessionId, pending);
      return pending.promise;
    }),
    onTodoListChanged: vi.fn(() => () => undefined),
    todoCreate: vi.fn(),
    todoUpdate: vi.fn(),
    todoDelete: vi.fn(),
    todoClear: vi.fn(),
  };

  beforeEach(() => {
    loadPromises.clear();
    ipcMock.todoGetList.mockClear();
    ipcMock.onTodoListChanged.mockClear();

    TestBed.configureTestingModule({
      providers: [
        TodoStore,
        { provide: TodoIpcService, useValue: ipcMock },
      ],
    });

    store = TestBed.inject(TodoStore);
  });

  it('ignores stale load results when sessions change quickly', async () => {
    const firstLoad = store.setSession('session-a');
    const secondLoad = store.setSession('session-b');

    loadPromises.get('session-b')?.resolve({
      success: true,
      data: createTodoList('session-b', 'Task from B'),
    });
    await secondLoad;

    expect(store.currentSessionId()).toBe('session-b');
    expect(store.todos().map((todo) => todo.content)).toEqual(['Task from B']);

    loadPromises.get('session-a')?.resolve({
      success: true,
      data: createTodoList('session-a', 'Task from A'),
    });
    await firstLoad;

    expect(store.currentSessionId()).toBe('session-b');
    expect(store.todos().map((todo) => todo.content)).toEqual(['Task from B']);
    expect(store.loading()).toBe(false);
  });
});
