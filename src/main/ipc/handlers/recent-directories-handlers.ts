/**
 * Recent Directories IPC Handlers
 * Handles operations for recently opened directories
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  IpcResponse,
  RecentDirsGetPayload,
  RecentDirsAddPayload,
  RecentDirsRemovePayload,
  RecentDirsPinPayload,
  RecentDirsClearPayload
} from '../../../shared/types/ipc.types';
import { getRecentDirectoriesManager } from '../../core/config/recent-directories-manager';
import { getSettingsManager } from '../../core/config/settings-manager';

export function registerRecentDirectoriesHandlers(): void {
  const manager = getRecentDirectoriesManager();

  // Initialize from settings
  try {
    const settings = getSettingsManager();

    // Apply max entries from settings
    const maxEntries = settings.get('maxRecentDirectories');
    if (maxEntries && maxEntries > 0) {
      manager.setMaxEntries(maxEntries);
    }

    // Seed with default working directory (one-time migration)
    const defaultDir = settings.get('defaultWorkingDirectory');
    if (defaultDir) {
      manager.seedFromDefaultDirectory(defaultDir);
    }

    // Listen for settings changes to update max entries
    settings.on('change', (key: string, value: unknown) => {
      if (key === 'maxRecentDirectories' && typeof value === 'number') {
        manager.setMaxEntries(value);
      }
    });
  } catch (error) {
    console.warn('[RecentDirectories] Failed to initialize from settings:', error);
  }

  // Get recent directories
  ipcMain.handle(
    IPC_CHANNELS.RECENT_DIRS_GET,
    async (
      _event: IpcMainInvokeEvent,
      payload?: RecentDirsGetPayload
    ): Promise<IpcResponse> => {
      try {
        const entries = manager.getDirectories({
          limit: payload?.limit,
          sortBy: payload?.sortBy,
          includePinned: payload?.includePinned
        });

        return {
          success: true,
          data: entries
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'RECENT_DIRS_GET_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Add a directory to recent list
  ipcMain.handle(
    IPC_CHANNELS.RECENT_DIRS_ADD,
    async (
      _event: IpcMainInvokeEvent,
      payload: RecentDirsAddPayload
    ): Promise<IpcResponse> => {
      try {
        if (!payload?.path) {
          return {
            success: false,
            error: {
              code: 'INVALID_PAYLOAD',
              message: 'Path is required',
              timestamp: Date.now()
            }
          };
        }

        const entry = manager.addDirectory(payload.path);

        return {
          success: true,
          data: entry
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'RECENT_DIRS_ADD_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Remove a directory from recent list
  ipcMain.handle(
    IPC_CHANNELS.RECENT_DIRS_REMOVE,
    async (
      _event: IpcMainInvokeEvent,
      payload: RecentDirsRemovePayload
    ): Promise<IpcResponse> => {
      try {
        if (!payload?.path) {
          return {
            success: false,
            error: {
              code: 'INVALID_PAYLOAD',
              message: 'Path is required',
              timestamp: Date.now()
            }
          };
        }

        const removed = manager.removeDirectory(payload.path);

        return {
          success: true,
          data: { removed }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'RECENT_DIRS_REMOVE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Pin or unpin a directory
  ipcMain.handle(
    IPC_CHANNELS.RECENT_DIRS_PIN,
    async (
      _event: IpcMainInvokeEvent,
      payload: RecentDirsPinPayload
    ): Promise<IpcResponse> => {
      try {
        if (!payload?.path) {
          return {
            success: false,
            error: {
              code: 'INVALID_PAYLOAD',
              message: 'Path is required',
              timestamp: Date.now()
            }
          };
        }

        const pinned = manager.pinDirectory(payload.path, payload.pinned);

        return {
          success: true,
          data: { pinned }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'RECENT_DIRS_PIN_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Clear all recent directories
  ipcMain.handle(
    IPC_CHANNELS.RECENT_DIRS_CLEAR,
    async (
      _event: IpcMainInvokeEvent,
      payload?: RecentDirsClearPayload
    ): Promise<IpcResponse> => {
      try {
        manager.clearAll(payload?.keepPinned !== false);

        return {
          success: true,
          data: null
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'RECENT_DIRS_CLEAR_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
