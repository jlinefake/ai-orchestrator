/**
 * Todo IPC Service - Todo list operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';
import type { TodoList } from '../../../../../shared/types/todo.types';

@Injectable({ providedIn: 'root' })
export class TodoIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  private get ngZone() {
    return this.base.getNgZone();
  }

  // ============================================
  // TODO Operations
  // ============================================

  /**
   * Get TODO list for a session
   */
  async todoGetList(sessionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.todoGetList(sessionId);
  }

  /**
   * Create a new TODO
   */
  async todoCreate(payload: {
    sessionId: string;
    content: string;
    activeForm?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    parentId?: string;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.todoCreate(payload);
  }

  /**
   * Update a TODO
   */
  async todoUpdate(payload: {
    sessionId: string;
    todoId: string;
    content?: string;
    activeForm?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.todoUpdate(payload);
  }

  /**
   * Delete a TODO
   */
  async todoDelete(sessionId: string, todoId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.todoDelete(sessionId, todoId);
  }

  /**
   * Write all TODOs at once (replaces existing)
   * This matches Claude's TodoWrite tool format
   */
  async todoWriteAll(payload: {
    sessionId: string;
    todos: {
      content: string;
      status: string;
      activeForm?: string;
    }[];
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.todoWriteAll(payload);
  }

  /**
   * Clear all TODOs for a session
   */
  async todoClear(sessionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.todoClear(sessionId);
  }

  /**
   * Get the current in-progress TODO
   */
  async todoGetCurrent(sessionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.todoGetCurrent(sessionId);
  }

  /**
   * Subscribe to TODO list changes
   */
  onTodoListChanged(callback: (data: { sessionId: string; list: TodoList }) => void): () => void {
    if (!this.api) return () => { /* noop */ };

    return this.api.onTodoListChanged((data) => {
      this.ngZone.run(() => callback(data as { sessionId: string; list: TodoList }));
    });
  }
}
