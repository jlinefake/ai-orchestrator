/**
 * VCS IPC Service - Git/VCS operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class VcsIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // VCS (Git) Operations
  // ============================================

  /**
   * Check if working directory is a git repository
   */
  async vcsIsRepo(workingDirectory: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.vcsIsRepo(workingDirectory);
  }

  /**
   * Get git status for working directory
   */
  async vcsGetStatus(workingDirectory: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.vcsGetStatus(workingDirectory);
  }

  /**
   * Get branches for working directory
   */
  async vcsGetBranches(workingDirectory: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.vcsGetBranches(workingDirectory);
  }

  /**
   * Get recent commits
   */
  async vcsGetCommits(workingDirectory: string, limit?: number): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.vcsGetCommits(workingDirectory, limit);
  }

  /**
   * Get diff (staged, unstaged, or between refs)
   */
  async vcsGetDiff(payload: {
    workingDirectory: string;
    type: 'staged' | 'unstaged' | 'between';
    fromRef?: string;
    toRef?: string;
    filePath?: string;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.vcsGetDiff(payload);
  }

  /**
   * Get file history (commits that modified the file)
   */
  async vcsGetFileHistory(workingDirectory: string, filePath: string, limit?: number): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.vcsGetFileHistory(workingDirectory, filePath, limit);
  }

  /**
   * Get file content at a specific commit
   */
  async vcsGetFileAtCommit(workingDirectory: string, filePath: string, commitHash: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.vcsGetFileAtCommit(workingDirectory, filePath, commitHash);
  }

  /**
   * Get blame information for a file
   */
  async vcsGetBlame(workingDirectory: string, filePath: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.vcsGetBlame(workingDirectory, filePath);
  }
}
