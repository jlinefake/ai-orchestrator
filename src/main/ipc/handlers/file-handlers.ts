/**
 * File Handlers - Editor, Watcher, and Multi-Edit operations
 * Handles external editor integration, file watching, and multi-file edits
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  EditorOpenFilePayload,
  EditorOpenFileAtLinePayload,
  EditorOpenDirectoryPayload,
  EditorSetPreferredPayload,
  WatcherStartPayload,
  WatcherStopPayload,
  WatcherGetChangesPayload,
  WatcherClearBufferPayload,
  MultiEditPayload
} from '../../../shared/types/ipc.types';
import { getExternalEditorManager } from '../../workspace/editor/external-editor';
import { getFileWatcherManager } from '../../workspace/watcher/file-watcher';
import { getMultiEditManager } from '../../workspace/multiedit-manager';
import { WindowManager } from '../../window-manager';

export function registerFileHandlers(deps: {
  windowManager: WindowManager;
}): void {
  const { windowManager } = deps;

  // ============================================
  // External Editor Handlers
  // ============================================

  const editorManager = getExternalEditorManager();

  // Detect available editors
  ipcMain.handle(
    IPC_CHANNELS.EDITOR_DETECT,
    async (): Promise<IpcResponse> => {
      try {
        const editors = await editorManager.detectEditors();
        return { success: true, data: editors };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'EDITOR_DETECT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Open file in editor
  ipcMain.handle(
    IPC_CHANNELS.EDITOR_OPEN_FILE,
    async (
      _event: IpcMainInvokeEvent,
      payload: EditorOpenFilePayload
    ): Promise<IpcResponse> => {
      try {
        const result = await editorManager.openFile(payload.filePath, {
          line: payload.line,
          column: payload.column,
          waitForClose: payload.waitForClose,
          newWindow: payload.newWindow
        });
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'EDITOR_OPEN_FILE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Open file at specific line
  ipcMain.handle(
    IPC_CHANNELS.EDITOR_OPEN_FILE_AT_LINE,
    async (
      _event: IpcMainInvokeEvent,
      payload: EditorOpenFileAtLinePayload
    ): Promise<IpcResponse> => {
      try {
        const result = await editorManager.openFileAtLine(
          payload.filePath,
          payload.line,
          payload.column
        );
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'EDITOR_OPEN_FILE_AT_LINE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Open directory in editor
  ipcMain.handle(
    IPC_CHANNELS.EDITOR_OPEN_DIRECTORY,
    async (
      _event: IpcMainInvokeEvent,
      payload: EditorOpenDirectoryPayload
    ): Promise<IpcResponse> => {
      try {
        const result = await editorManager.openDirectory(payload.dirPath);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'EDITOR_OPEN_DIRECTORY_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Set preferred editor
  ipcMain.handle(
    IPC_CHANNELS.EDITOR_SET_PREFERRED,
    async (
      _event: IpcMainInvokeEvent,
      payload: EditorSetPreferredPayload
    ): Promise<IpcResponse> => {
      try {
        editorManager.setPreferredEditor({
          type: payload.type as import('../../workspace/editor/external-editor').EditorType,
          path: payload.path,
          args: payload.args
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'EDITOR_SET_PREFERRED_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get preferred editor
  ipcMain.handle(
    IPC_CHANNELS.EDITOR_GET_PREFERRED,
    async (): Promise<IpcResponse> => {
      try {
        const editor = editorManager.getPreferredEditor();
        return { success: true, data: editor };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'EDITOR_GET_PREFERRED_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get available editors
  ipcMain.handle(
    IPC_CHANNELS.EDITOR_GET_AVAILABLE,
    async (): Promise<IpcResponse> => {
      try {
        const editors = editorManager.getAvailableEditors();
        return { success: true, data: editors };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'EDITOR_GET_AVAILABLE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // ============================================
  // File Watcher Handlers
  // ============================================

  const watcherManager = getFileWatcherManager();

  // Start watching
  ipcMain.handle(
    IPC_CHANNELS.WATCHER_START,
    async (
      _event: IpcMainInvokeEvent,
      payload: WatcherStartPayload
    ): Promise<IpcResponse> => {
      try {
        const sessionId = await watcherManager.watch(payload.directory, {
          ignored: payload.ignored,
          useGitignore: payload.useGitignore,
          depth: payload.depth,
          ignoreInitial: payload.ignoreInitial
        });
        return { success: true, data: { sessionId } };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WATCHER_START_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Stop watching
  ipcMain.handle(
    IPC_CHANNELS.WATCHER_STOP,
    async (
      _event: IpcMainInvokeEvent,
      payload: WatcherStopPayload
    ): Promise<IpcResponse> => {
      try {
        await watcherManager.unwatch(payload.sessionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WATCHER_STOP_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Stop all watchers
  ipcMain.handle(
    IPC_CHANNELS.WATCHER_STOP_ALL,
    async (): Promise<IpcResponse> => {
      try {
        await watcherManager.unwatchAll();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WATCHER_STOP_ALL_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get active sessions
  ipcMain.handle(
    IPC_CHANNELS.WATCHER_GET_SESSIONS,
    async (): Promise<IpcResponse> => {
      try {
        const sessions = watcherManager.getActiveSessions();
        return { success: true, data: sessions };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WATCHER_GET_SESSIONS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get recent changes
  ipcMain.handle(
    IPC_CHANNELS.WATCHER_GET_CHANGES,
    async (
      _event: IpcMainInvokeEvent,
      payload: WatcherGetChangesPayload
    ): Promise<IpcResponse> => {
      try {
        const changes = watcherManager.getRecentChanges(
          payload.sessionId,
          payload.limit
        );
        return { success: true, data: changes };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WATCHER_GET_CHANGES_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Clear event buffer
  ipcMain.handle(
    IPC_CHANNELS.WATCHER_CLEAR_BUFFER,
    async (
      _event: IpcMainInvokeEvent,
      payload: WatcherClearBufferPayload
    ): Promise<IpcResponse> => {
      try {
        watcherManager.clearEventBuffer(payload.sessionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WATCHER_CLEAR_BUFFER_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Forward watcher events to renderer
  watcherManager.on('file-changed', (data) => {
    windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.WATCHER_FILE_CHANGED, data);
  });

  watcherManager.on('file-added', (data) => {
    windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.WATCHER_FILE_CHANGED, data);
  });

  watcherManager.on('file-removed', (data) => {
    windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.WATCHER_FILE_CHANGED, data);
  });

  watcherManager.on('error', (data) => {
    windowManager.getMainWindow()?.webContents.send('watcher:error', data);
  });

  // ============================================
  // Multi-Edit Handlers
  // ============================================

  const multiEdit = getMultiEditManager();

  // Preview edits without applying
  ipcMain.handle(
    IPC_CHANNELS.MULTIEDIT_PREVIEW,
    async (
      event: IpcMainInvokeEvent,
      payload: MultiEditPayload
    ): Promise<IpcResponse> => {
      try {
        const preview = await multiEdit.preview(payload.edits);
        return {
          success: true,
          data: preview
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MULTIEDIT_PREVIEW_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Apply edits atomically
  ipcMain.handle(
    IPC_CHANNELS.MULTIEDIT_APPLY,
    async (
      event: IpcMainInvokeEvent,
      payload: MultiEditPayload
    ): Promise<IpcResponse> => {
      try {
        const result = await multiEdit.apply(payload.edits, {
          instanceId: payload.instanceId,
          takeSnapshots: payload.takeSnapshots
        });
        return {
          success: result.success,
          data: result,
          error: result.success
            ? undefined
            : {
                code: 'MULTIEDIT_APPLY_FAILED',
                message: result.error || 'Unknown error',
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MULTIEDIT_APPLY_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
