/**
 * Hooks IPC Service - Hooks and approvals operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';
import type { HookContext, HookRule } from '../../../../../shared/types/hook.types';

type HookSource = 'built-in' | 'project' | 'user';

@Injectable({ providedIn: 'root' })
export class HooksIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private isIpcResponse(value: unknown): value is IpcResponse {
    return this.isRecord(value) && typeof value['success'] === 'boolean';
  }

  private toIpcResponse<T>(value: unknown): IpcResponse<T> {
    if (this.isIpcResponse(value)) {
      return value as IpcResponse<T>;
    }
    return { success: true, data: value as T };
  }

  private async invokeChannel<T = unknown>(
    channel: string,
    payload?: unknown
  ): Promise<IpcResponse<T>> {
    if (!this.api) {
      return { success: false, error: { message: 'Not in Electron' } };
    }

    try {
      const raw = await this.base.invoke<T>(channel, payload);
      return this.toIpcResponse<T>(raw);
    } catch (error) {
      return { success: false, error: { message: (error as Error).message } };
    }
  }

  // ============================================
  // Hooks Operations
  // ============================================

  /**
   * List hooks
   */
  async hooksList(filter?: {
    event?: string;
    source?: HookSource;
  }): Promise<IpcResponse<HookRule[]>> {
    return this.invokeChannel<HookRule[]>('hooks:list', filter);
  }

  /**
   * Get a hook by ID
   */
  async hooksGet(ruleId: string): Promise<IpcResponse<HookRule>> {
    return this.invokeChannel<HookRule>('hooks:get', { ruleId });
  }

  /**
   * Create a new hook
   */
  async hooksCreate(rule: {
    name: string;
    enabled: boolean;
    event: string;
    toolMatcher?: string;
    conditions: {
      field: string;
      operator:
        | 'regex_match'
        | 'contains'
        | 'not_contains'
        | 'equals'
        | 'starts_with'
        | 'ends_with';
      pattern: string;
    }[];
    action: 'warn' | 'block';
    message: string;
  }): Promise<IpcResponse<HookRule>> {
    return this.invokeChannel<HookRule>('hooks:create', { rule });
  }

  /**
   * Update a hook
   */
  async hooksUpdate(
    ruleId: string,
    updates: {
      name?: string;
      enabled?: boolean;
      conditions?: {
        field: string;
        operator:
          | 'regex_match'
          | 'contains'
          | 'not_contains'
          | 'equals'
          | 'starts_with'
          | 'ends_with';
        pattern: string;
      }[];
      action?: 'warn' | 'block';
      message?: string;
    }
  ): Promise<IpcResponse<HookRule>> {
    return this.invokeChannel<HookRule>('hooks:update', { ruleId, updates });
  }

  /**
   * Delete a hook
   */
  async hooksDelete(ruleId: string): Promise<IpcResponse<boolean>> {
    return this.invokeChannel<boolean>('hooks:delete', { ruleId });
  }

  /**
   * Evaluate hooks for an event
   */
  async hooksEvaluate(context: HookContext): Promise<IpcResponse> {
    return this.invokeChannel('hooks:evaluate', { context });
  }

  /**
   * Import hooks from serialized rules
   */
  async hooksImport(rules: HookRule[], overwrite = false): Promise<IpcResponse<HookRule[]>> {
    return this.invokeChannel<HookRule[]>('hooks:import', { rules, overwrite });
  }

  /**
   * Export hooks by source
   */
  async hooksExport(source?: HookSource): Promise<IpcResponse<HookRule[]>> {
    return this.invokeChannel<HookRule[]>('hooks:export', source ? { source } : undefined);
  }

  /**
   * List hook approvals
   */
  async hookApprovalsList(pendingOnly = false): Promise<IpcResponse> {
    return this.invokeChannel('hooks:approvals:list', { pendingOnly });
  }

  /**
   * Update a hook approval decision
   */
  async hookApprovalsUpdate(hookId: string, approved: boolean): Promise<IpcResponse> {
    return this.invokeChannel('hooks:approvals:update', { hookId, approved });
  }

  /**
   * Clear approvals for one or more hooks
   */
  async hookApprovalsClear(hookIds?: string[]): Promise<IpcResponse> {
    return this.invokeChannel(
      'hooks:approvals:clear',
      hookIds && hookIds.length > 0 ? { hookIds } : undefined
    );
  }
}
