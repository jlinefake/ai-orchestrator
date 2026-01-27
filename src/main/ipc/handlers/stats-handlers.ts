/**
 * Stats IPC Handlers
 * Handles usage statistics tracking and retrieval
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  StatsRecordSessionStartPayload,
  StatsRecordSessionEndPayload,
  StatsRecordMessagePayload,
  StatsRecordToolUsagePayload,
  StatsGetPayload,
  StatsGetSessionPayload,
  StatsExportPayload
} from '../../../shared/types/ipc.types';
import { getUsageStatsManager } from '../../core/system/usage-stats';

export function registerStatsHandlers(): void {
  const statsManager = getUsageStatsManager();

  // Record session start
  ipcMain.handle(
    IPC_CHANNELS.STATS_RECORD_SESSION_START,
    async (
      _event: IpcMainInvokeEvent,
      payload: StatsRecordSessionStartPayload
    ): Promise<IpcResponse> => {
      try {
        statsManager.recordSessionStart(
          payload.sessionId,
          payload.instanceId,
          payload.agentId,
          payload.workingDirectory
        );
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_RECORD_SESSION_START_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Record session end
  ipcMain.handle(
    IPC_CHANNELS.STATS_RECORD_SESSION_END,
    async (
      _event: IpcMainInvokeEvent,
      payload: StatsRecordSessionEndPayload
    ): Promise<IpcResponse> => {
      try {
        statsManager.recordSessionEnd(payload.sessionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_RECORD_SESSION_END_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Record message
  ipcMain.handle(
    IPC_CHANNELS.STATS_RECORD_MESSAGE,
    async (
      _event: IpcMainInvokeEvent,
      payload: StatsRecordMessagePayload
    ): Promise<IpcResponse> => {
      try {
        statsManager.recordMessage(
          payload.sessionId,
          payload.inputTokens,
          payload.outputTokens,
          payload.cost
        );
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_RECORD_MESSAGE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Record tool usage
  ipcMain.handle(
    IPC_CHANNELS.STATS_RECORD_TOOL_USAGE,
    async (
      _event: IpcMainInvokeEvent,
      payload: StatsRecordToolUsagePayload
    ): Promise<IpcResponse> => {
      try {
        statsManager.recordToolUsage(payload.sessionId, payload.tool);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_RECORD_TOOL_USAGE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get stats
  ipcMain.handle(
    IPC_CHANNELS.STATS_GET,
    async (
      _event: IpcMainInvokeEvent,
      payload: StatsGetPayload
    ): Promise<IpcResponse> => {
      try {
        const stats = statsManager.getStats(payload.period);
        return { success: true, data: stats };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_GET_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get session stats
  ipcMain.handle(
    IPC_CHANNELS.STATS_GET_SESSION,
    async (
      _event: IpcMainInvokeEvent,
      payload: StatsGetSessionPayload
    ): Promise<IpcResponse> => {
      try {
        const stats = statsManager.getSessionStats(payload.sessionId);
        return { success: true, data: stats };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_GET_SESSION_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get active sessions
  ipcMain.handle(
    IPC_CHANNELS.STATS_GET_ACTIVE_SESSIONS,
    async (): Promise<IpcResponse> => {
      try {
        const sessions = statsManager.getActiveSessions();
        return { success: true, data: sessions };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_GET_ACTIVE_SESSIONS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get tool usage
  ipcMain.handle(
    IPC_CHANNELS.STATS_GET_TOOL_USAGE,
    async (): Promise<IpcResponse> => {
      try {
        const usage = statsManager.getToolUsage();
        return { success: true, data: usage };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_GET_TOOL_USAGE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Export stats
  ipcMain.handle(
    IPC_CHANNELS.STATS_EXPORT,
    async (
      _event: IpcMainInvokeEvent,
      payload: StatsExportPayload
    ): Promise<IpcResponse> => {
      try {
        statsManager.exportStats(payload.filePath, payload.period);
        return { success: true, data: { exportPath: payload.filePath } };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_EXPORT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Clear stats
  ipcMain.handle(IPC_CHANNELS.STATS_CLEAR, async (): Promise<IpcResponse> => {
    try {
      statsManager.clearStats();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STATS_CLEAR_FAILED',
          message: (error as Error).message,
          timestamp: Date.now()
        }
      };
    }
  });

  // Get storage usage
  ipcMain.handle(
    IPC_CHANNELS.STATS_GET_STORAGE,
    async (): Promise<IpcResponse> => {
      try {
        const storage = statsManager.getStorageUsage();
        return { success: true, data: storage };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_GET_STORAGE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
