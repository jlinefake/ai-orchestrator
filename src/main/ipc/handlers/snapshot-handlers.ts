/**
 * Snapshot IPC Handlers
 * Handles snapshot-related IPC communication from renderer
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  SnapshotTakePayload,
  SnapshotStartSessionPayload,
  SnapshotEndSessionPayload,
  SnapshotGetForInstancePayload,
  SnapshotGetForFilePayload,
  SnapshotGetSessionsPayload,
  SnapshotGetContentPayload,
  SnapshotRevertFilePayload,
  SnapshotRevertSessionPayload,
  SnapshotGetDiffPayload,
  SnapshotDeletePayload,
  SnapshotCleanupPayload
} from '../../../shared/types/ipc.types';
import { getSnapshotManager } from '../../persistence/snapshot-manager';

export function registerSnapshotHandlers(): void {
  const snapshots = getSnapshotManager();

  // Take a snapshot
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_TAKE,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotTakePayload
    ): Promise<IpcResponse> => {
      try {
        const snapshotId = snapshots.takeSnapshot(
          payload.filePath,
          payload.instanceId,
          payload.sessionId,
          payload.action
        );
        return {
          success: true,
          data: { snapshotId }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_TAKE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Start a session
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_START_SESSION,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotStartSessionPayload
    ): Promise<IpcResponse> => {
      try {
        const sessionId = snapshots.startSession(
          payload.instanceId,
          payload.description
        );
        return {
          success: true,
          data: { sessionId }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_START_SESSION_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // End a session
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_END_SESSION,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotEndSessionPayload
    ): Promise<IpcResponse> => {
      try {
        const session = snapshots.endSession(payload.sessionId);
        return {
          success: true,
          data: session
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_END_SESSION_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get snapshots for instance
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_GET_FOR_INSTANCE,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotGetForInstancePayload
    ): Promise<IpcResponse> => {
      try {
        const snapshotList = snapshots.getSnapshotsForInstance(
          payload.instanceId
        );
        return {
          success: true,
          data: snapshotList
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_GET_FOR_INSTANCE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get snapshots for file
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_GET_FOR_FILE,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotGetForFilePayload
    ): Promise<IpcResponse> => {
      try {
        const snapshotList = snapshots.getSnapshotsForFile(payload.filePath);
        return {
          success: true,
          data: snapshotList
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_GET_FOR_FILE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get sessions for instance
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_GET_SESSIONS,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotGetSessionsPayload
    ): Promise<IpcResponse> => {
      try {
        const sessions = snapshots.getSessionsForInstance(payload.instanceId);
        return {
          success: true,
          data: sessions
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_GET_SESSIONS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get snapshot content
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_GET_CONTENT,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotGetContentPayload
    ): Promise<IpcResponse> => {
      try {
        const content = snapshots.getSnapshotContent(payload.snapshotId);
        return {
          success: true,
          data: { content }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_GET_CONTENT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Revert a file
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_REVERT_FILE,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotRevertFilePayload
    ): Promise<IpcResponse> => {
      try {
        const result = snapshots.revertFile(payload.snapshotId);
        return {
          success: result.success,
          data: result,
          error: result.success
            ? undefined
            : {
                code: 'SNAPSHOT_REVERT_FAILED',
                message: result.errors.map((e) => e.error).join(', '),
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_REVERT_FILE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Revert a session
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_REVERT_SESSION,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotRevertSessionPayload
    ): Promise<IpcResponse> => {
      try {
        const result = snapshots.revertSession(payload.sessionId);
        return {
          success: result.success,
          data: result,
          error: result.success
            ? undefined
            : {
                code: 'SNAPSHOT_REVERT_SESSION_FAILED',
                message: result.errors.map((e) => e.error).join(', '),
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_REVERT_SESSION_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get diff between snapshot and current
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_GET_DIFF,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotGetDiffPayload
    ): Promise<IpcResponse> => {
      try {
        const diff = snapshots.getSnapshotDiff(payload.snapshotId);
        return {
          success: true,
          data: diff
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_GET_DIFF_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Delete a snapshot
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_DELETE,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotDeletePayload
    ): Promise<IpcResponse> => {
      try {
        const deleted = snapshots.deleteSnapshot(payload.snapshotId);
        return {
          success: deleted,
          error: deleted
            ? undefined
            : {
                code: 'SNAPSHOT_NOT_FOUND',
                message: `Snapshot ${payload.snapshotId} not found`,
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_DELETE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Cleanup old snapshots
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_CLEANUP,
    async (
      event: IpcMainInvokeEvent,
      payload: SnapshotCleanupPayload
    ): Promise<IpcResponse> => {
      try {
        const deletedCount = snapshots.cleanupOldSnapshots(
          payload.maxAgeDays
        );
        return {
          success: true,
          data: { deletedCount }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_CLEANUP_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get stats
  ipcMain.handle(
    IPC_CHANNELS.SNAPSHOT_GET_STATS,
    async (): Promise<IpcResponse> => {
      try {
        const stats = snapshots.getStats();
        return {
          success: true,
          data: stats
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SNAPSHOT_GET_STATS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
