/**
 * Snapshot IPC Service - Snapshot/file revert operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class SnapshotIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // Snapshot Operations (File Revert)
  // ============================================

  /**
   * Take a snapshot before file modification
   */
  async snapshotTake(payload: {
    filePath: string;
    instanceId: string;
    sessionId?: string;
    action?: 'create' | 'modify' | 'delete';
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotTake(payload);
  }

  /**
   * Start a snapshot session
   */
  async snapshotStartSession(instanceId: string, description?: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotStartSession(instanceId, description);
  }

  /**
   * End a snapshot session
   */
  async snapshotEndSession(sessionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotEndSession(sessionId);
  }

  /**
   * Get all snapshots for an instance
   */
  async snapshotGetForInstance(instanceId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotGetForInstance(instanceId);
  }

  /**
   * Get all snapshots for a file
   */
  async snapshotGetForFile(filePath: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotGetForFile(filePath);
  }

  /**
   * Get all sessions for an instance
   */
  async snapshotGetSessions(instanceId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotGetSessions(instanceId);
  }

  /**
   * Get content from a snapshot
   */
  async snapshotGetContent(snapshotId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotGetContent(snapshotId);
  }

  /**
   * Revert a file to a specific snapshot
   */
  async snapshotRevertFile(snapshotId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotRevertFile(snapshotId);
  }

  /**
   * Revert all files in a session
   */
  async snapshotRevertSession(sessionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotRevertSession(sessionId);
  }

  /**
   * Get diff between snapshot and current file
   */
  async snapshotGetDiff(snapshotId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotGetDiff(snapshotId);
  }

  /**
   * Delete a snapshot
   */
  async snapshotDelete(snapshotId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotDelete(snapshotId);
  }

  /**
   * Cleanup old snapshots
   */
  async snapshotCleanup(maxAgeDays?: number): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotCleanup(maxAgeDays);
  }

  /**
   * Get snapshot storage stats
   */
  async snapshotGetStats(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.snapshotGetStats();
  }
}
