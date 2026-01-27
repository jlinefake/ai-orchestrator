/**
 * Training IPC Service - Training/GRPO operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class TrainingIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // Training/GRPO
  // ============================================

  /**
   * Record training outcome
   */
  async trainingRecordOutcome(payload: {
    taskId: string;
    prompt: string;
    response: string;
    reward: number;
    strategy?: string;
    context?: string;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.trainingRecordOutcome(payload);
  }

  /**
   * Get training stats
   */
  async trainingGetStats(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.trainingGetStats();
  }

  /**
   * Export training data
   */
  async trainingExportData(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.trainingExportData();
  }

  /**
   * Import training data
   */
  async trainingImportData(data: Record<string, unknown>): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.trainingImportData(data);
  }

  /**
   * Get reward trend
   */
  async trainingGetTrend(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.trainingGetTrend();
  }

  /**
   * Get top strategies
   */
  async trainingGetTopStrategies(limit?: number): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.trainingGetTopStrategies(limit);
  }

  /**
   * Configure training
   */
  async trainingConfigure(config: Record<string, unknown>): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.trainingConfigure(config);
  }
}
