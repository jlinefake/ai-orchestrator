/**
 * Base Electron IPC Service - Core IPC communication bridge
 *
 * This is the foundation service that provides low-level IPC communication
 * between the Angular renderer and Electron main process.
 *
 * Domain-specific services should inject this and use invoke/on methods.
 */

import { Injectable, NgZone, inject } from '@angular/core';
import type { ElectronAPI } from '../../../../../preload/preload';

/** Standard IPC response structure */
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

/** File entry from directory listing */
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modifiedAt: number;
  createdAt?: number;
  extension?: string;
}

/** Copilot model info returned from CLI */
export interface CopilotModelInfo {
  id: string;
  name: string;
  supportsVision: boolean;
  contextWindow: number;
  enabled: boolean;
}

// Declare the electronAPI on window
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

@Injectable({ providedIn: 'root' })
export class ElectronIpcService {
  private ngZone = inject(NgZone);
  private api: ElectronAPI | null = null;

  constructor() {
    // Access the API exposed by preload script
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.api = window.electronAPI;
    } else {
      console.warn('Electron API not available - running in browser mode');
    }
  }

  /**
   * Check if running in Electron
   */
  get isElectron(): boolean {
    return this.api !== null;
  }

  /**
   * Get current platform
   */
  get platform(): string {
    return this.api?.platform || 'browser';
  }

  /**
   * Get the underlying Electron API
   * Used by domain services to access specific API methods
   */
  getApi(): ElectronAPI | null {
    return this.api;
  }

  /**
   * Get NgZone for running callbacks in Angular zone
   */
  getNgZone(): NgZone {
    return this.ngZone;
  }

  /**
   * Generic invoke method for IPC calls
   * Use this for custom/dynamic IPC channels
   */
  async invoke<T = unknown>(channel: string, payload?: unknown): Promise<IpcResponse<T>> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };

    // Use the underlying ipcRenderer.invoke via preload
    if ((this.api as Record<string, unknown>)['invoke']) {
      return (this.api as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)['invoke'](channel, payload) as Promise<IpcResponse<T>>;
    }

    // Fallback: map to specific method if available
    console.warn(`No invoke method available, channel: ${channel}`);
    return { success: false, error: { message: `Channel not supported: ${channel}` } };
  }

  /**
   * Generic event listener for IPC events
   * Returns an unsubscribe function
   */
  on(channel: string, callback: (data: unknown) => void): () => void {
    if (!this.api) return () => { /* noop */ };

    if ((this.api as Record<string, unknown>)['on']) {
      return (this.api as unknown as Record<string, (...args: unknown[]) => () => void>)['on'](channel, (data: unknown) => {
        this.ngZone.run(() => callback(data));
      });
    }

    console.warn(`No on method available, channel: ${channel}`);
    return () => { /* noop */ };
  }

  /**
   * Helper to wrap API calls with standard error handling
   */
  protected async wrapApiCall<T>(
    apiMethod: () => Promise<IpcResponse<T>>
  ): Promise<IpcResponse<T>> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return apiMethod();
  }

  /**
   * Helper to wrap event subscriptions with NgZone
   */
  protected wrapEventSubscription<T>(
    subscribe: (callback: (data: T) => void) => () => void,
    callback: (data: T) => void
  ): () => void {
    if (!this.api) return () => { /* noop */ };
    return subscribe((data: T) => {
      this.ngZone.run(() => callback(data));
    });
  }
}
