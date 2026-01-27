/**
 * App IPC Service - Application-level operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class AppIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  /**
   * Signal app ready
   */
  async appReady(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.appReady();
  }

  /**
   * Get app version
   */
  async getVersion(): Promise<string> {
    if (!this.api) return '0.0.0-browser';
    const response = await this.api.getVersion();
    return response.success ? (response.data as string) : '0.0.0';
  }
}
