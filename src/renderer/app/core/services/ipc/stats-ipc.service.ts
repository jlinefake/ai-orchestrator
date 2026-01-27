/**
 * Stats IPC Service - Usage statistics operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class StatsIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // Usage Stats
  // ============================================

  /**
   * Record session start
   */
  async statsRecordSessionStart(
    sessionId: string,
    instanceId: string,
    agentId: string,
    workingDirectory: string
  ): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.statsRecordSessionStart(sessionId, instanceId, agentId, workingDirectory);
  }

  /**
   * Record session end
   */
  async statsRecordSessionEnd(sessionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.statsRecordSessionEnd(sessionId);
  }

  /**
   * Record message stats
   */
  async statsRecordMessage(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    cost: number
  ): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.statsRecordMessage(sessionId, inputTokens, outputTokens, cost);
  }

  /**
   * Record tool usage
   */
  async statsRecordToolUsage(sessionId: string, tool: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.statsRecordToolUsage(sessionId, tool);
  }

  /**
   * Get stats for a period
   */
  async statsGetStats(period: 'day' | 'week' | 'month' | 'year' | 'all'): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.statsGetStats(period);
  }

  /**
   * Export stats
   */
  async statsExport(filePath: string, period?: 'day' | 'week' | 'month' | 'year' | 'all'): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.statsExport(filePath, period);
  }
}
