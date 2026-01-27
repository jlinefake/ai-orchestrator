/**
 * Hooks IPC Service - Hooks and approvals operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class HooksIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // Hooks Operations
  // ============================================

  /**
   * List hooks
   */
  async hooksList(filter?: { event?: string; scope?: string }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.hooksList(filter);
  }

  /**
   * Get a hook by ID
   */
  async hooksGet(hookId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.hooksGet(hookId);
  }

  /**
   * Create a new hook
   */
  async hooksCreate(payload: {
    name: string;
    event: string;
    command: string;
    conditions?: Record<string, unknown>;
    scope?: 'global' | 'project';
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.hooksCreate(payload);
  }

  /**
   * Update a hook
   */
  async hooksUpdate(hookId: string, updates: Record<string, unknown>): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.hooksUpdate(hookId, updates);
  }

  /**
   * Delete a hook
   */
  async hooksDelete(hookId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.hooksDelete(hookId);
  }

  /**
   * Evaluate hooks for an event
   */
  async hooksEvaluate(event: string, context: Record<string, unknown>): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.hooksEvaluate(event, context);
  }

  /**
   * Import hooks from file
   */
  async hooksImport(filePath: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.hooksImport(filePath);
  }

  /**
   * Export hooks to file
   */
  async hooksExport(filePath: string, hookIds?: string[]): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.hooksExport(filePath, hookIds);
  }
}
