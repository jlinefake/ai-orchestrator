/**
 * Logging IPC Service - Logging and debug operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class LoggingIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // Logging
  // ============================================

  /**
   * Log a message
   */
  async logMessage(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: string,
    metadata?: Record<string, unknown>
  ): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.logMessage(level, message, context, metadata);
  }

  /**
   * Get logs
   */
  async logGetLogs(options?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    context?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.logGetLogs(options);
  }

  /**
   * Set log level
   */
  async logSetLevel(level: 'debug' | 'info' | 'warn' | 'error'): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.logSetLevel(level);
  }

  /**
   * Export logs
   */
  async logExport(filePath: string, options?: { format?: 'json' | 'csv'; compress?: boolean }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.logExport(filePath, options);
  }

  /**
   * Clear logs
   */
  async logClear(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.logClear();
  }

  // ============================================
  // Debug Commands
  // ============================================

  /**
   * Execute debug command
   */
  async debugExecute(command: string, args?: Record<string, unknown>): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debugExecute(command, args);
  }

  /**
   * Get available debug commands
   */
  async debugGetCommands(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debugGetCommands();
  }

  /**
   * Get debug info
   */
  async debugGetInfo(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debugGetInfo();
  }

  /**
   * Run diagnostics
   */
  async debugRunDiagnostics(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debugRunDiagnostics();
  }
}
