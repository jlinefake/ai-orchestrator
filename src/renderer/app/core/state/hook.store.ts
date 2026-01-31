/**
 * Hook Store - State management for hooks
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HooksIpcService } from '../services/ipc/hooks-ipc.service';
import type { HookRule } from '../../../../shared/types/hook.types';

@Injectable({ providedIn: 'root' })
export class HookStore {
  private ipcService = inject(HooksIpcService);

  // State
  private _hooks = signal<HookRule[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Selectors
  hooks = this._hooks.asReadonly();
  loading = this._loading.asReadonly();
  error = this._error.asReadonly();

  /**
   * Get count of enabled hooks
   */
  enabledHookCount = computed(() =>
    this._hooks().filter(h => h.enabled).length
  );

  /**
   * Get enabled hooks
   */
  enabledHooks = computed(() =>
    this._hooks().filter(h => h.enabled)
  );

  /**
   * Get hooks by event type
   */
  getHooksByEvent(event: string): HookRule[] {
    return this._hooks().filter(h => h.event === event || h.event === 'all');
  }

  /**
   * Load all hooks
   */
  async loadHooks(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await this.ipcService.hooksList();
      if (response.success && 'data' in response && response.data) {
        this._hooks.set(response.data as HookRule[]);
      } else {
        const errorMsg = 'error' in response ? response.error?.message : 'Failed to load hooks';
        this._error.set(errorMsg || 'Failed to load hooks');
      }
    } catch (err) {
      this._error.set((err as Error).message);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Get a hook by ID
   */
  getHookById(hookId: string): HookRule | undefined {
    return this._hooks().find(h => h.id === hookId);
  }
}
