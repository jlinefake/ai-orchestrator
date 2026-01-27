/**
 * Session, Archive, and History IPC Handlers
 * Handles session management, archiving, and conversation history operations
 */

import { ipcMain, IpcMainInvokeEvent, dialog, clipboard, shell } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  SessionForkPayload,
  SessionExportPayload,
  SessionImportPayload,
  SessionCopyToClipboardPayload,
  SessionSaveToFilePayload,
  SessionRevealFilePayload,
  ArchiveSessionPayload,
  ArchiveListPayload,
  ArchiveRestorePayload,
  ArchiveDeletePayload,
  ArchiveGetMetaPayload,
  ArchiveUpdateTagsPayload,
  ArchiveCleanupPayload,
  HistoryListPayload,
  HistoryLoadPayload,
  HistoryDeletePayload,
  HistoryRestorePayload
} from '../../../shared/types/ipc.types';
import type { ExportedSession } from '../../../shared/types/instance.types';
import type { InstanceManager } from '../../instance/instance-manager';
import { getHistoryManager } from '../../history';
import { getSessionArchiveManager } from '../../session/session-archive';

interface SessionHandlersDeps {
  instanceManager: InstanceManager;
  serializeInstance: (instance: any) => Record<string, unknown>;
}

/**
 * Register session, archive, and history IPC handlers
 */
export function registerSessionHandlers(deps: SessionHandlersDeps): void {
  const { instanceManager, serializeInstance } = deps;

  // ============================================
  // Session Handlers
  // ============================================

  // Fork session
  ipcMain.handle(
    IPC_CHANNELS.SESSION_FORK,
    async (
      event: IpcMainInvokeEvent,
      payload: SessionForkPayload
    ): Promise<IpcResponse> => {
      try {
        const forkedInstance = await instanceManager.forkInstance({
          instanceId: payload.instanceId,
          atMessageIndex: payload.atMessageIndex,
          displayName: payload.displayName
        });
        return {
          success: true,
          data: serializeInstance(forkedInstance)
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SESSION_FORK_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Export session
  ipcMain.handle(
    IPC_CHANNELS.SESSION_EXPORT,
    async (
      event: IpcMainInvokeEvent,
      payload: SessionExportPayload
    ): Promise<IpcResponse> => {
      try {
        if (payload.format === 'json') {
          const exported = instanceManager.exportSession(payload.instanceId);
          return {
            success: true,
            data: exported
          };
        } else {
          const markdown = instanceManager.exportSessionMarkdown(
            payload.instanceId
          );
          return {
            success: true,
            data: markdown
          };
        }
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SESSION_EXPORT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Import session
  ipcMain.handle(
    IPC_CHANNELS.SESSION_IMPORT,
    async (
      event: IpcMainInvokeEvent,
      payload: SessionImportPayload
    ): Promise<IpcResponse> => {
      try {
        // Read and parse the file
        const fs = require('fs').promises;
        const content = await fs.readFile(payload.filePath, 'utf-8');
        const session: ExportedSession = JSON.parse(content);

        // Validate version
        if (!session.version || !session.messages) {
          return {
            success: false,
            error: {
              code: 'INVALID_SESSION_FORMAT',
              message: 'Invalid session file format',
              timestamp: Date.now()
            }
          };
        }

        const instance = await instanceManager.importSession(
          session,
          payload.workingDirectory
        );

        return {
          success: true,
          data: serializeInstance(instance)
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SESSION_IMPORT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Copy session to clipboard
  ipcMain.handle(
    IPC_CHANNELS.SESSION_COPY_TO_CLIPBOARD,
    async (
      event: IpcMainInvokeEvent,
      payload: SessionCopyToClipboardPayload
    ): Promise<IpcResponse> => {
      try {
        let content: string;
        if (payload.format === 'json') {
          const exported = instanceManager.exportSession(payload.instanceId);
          content = JSON.stringify(exported, null, 2);
        } else {
          content = instanceManager.exportSessionMarkdown(payload.instanceId);
        }

        clipboard.writeText(content);
        return {
          success: true,
          data: { copied: true, format: payload.format }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SESSION_COPY_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Save session to file
  ipcMain.handle(
    IPC_CHANNELS.SESSION_SAVE_TO_FILE,
    async (
      event: IpcMainInvokeEvent,
      payload: SessionSaveToFilePayload
    ): Promise<IpcResponse> => {
      try {
        let filePath = payload.filePath;

        // Show save dialog if no path provided
        if (!filePath) {
          const instance = instanceManager.getInstance(payload.instanceId);
          const defaultName =
            instance?.displayName?.replace(/[^a-z0-9]/gi, '_') || 'session';
          const extension = payload.format === 'json' ? 'json' : 'md';

          const result = await dialog.showSaveDialog({
            title: 'Save Session',
            defaultPath: `${defaultName}.${extension}`,
            filters: [
              payload.format === 'json'
                ? { name: 'JSON', extensions: ['json'] }
                : { name: 'Markdown', extensions: ['md'] }
            ]
          });

          if (result.canceled || !result.filePath) {
            return {
              success: false,
              error: {
                code: 'SAVE_CANCELLED',
                message: 'Save cancelled',
                timestamp: Date.now()
              }
            };
          }
          filePath = result.filePath;
        }

        // Export and write
        let content: string;
        if (payload.format === 'json') {
          const exported = instanceManager.exportSession(payload.instanceId);
          content = JSON.stringify(exported, null, 2);
        } else {
          content = instanceManager.exportSessionMarkdown(payload.instanceId);
        }

        const fs = require('fs').promises;
        await fs.writeFile(filePath, content, 'utf-8');

        return { success: true, data: { filePath, format: payload.format } };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SESSION_SAVE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Reveal file in system file manager
  ipcMain.handle(
    IPC_CHANNELS.SESSION_REVEAL_FILE,
    async (
      event: IpcMainInvokeEvent,
      payload: SessionRevealFilePayload
    ): Promise<IpcResponse> => {
      try {
        shell.showItemInFolder(payload.filePath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REVEAL_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // ============================================
  // Archive Handlers
  // ============================================

  const archiveManager = getSessionArchiveManager();

  // Archive session - requires an Instance object
  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_SESSION,
    async (
      event: IpcMainInvokeEvent,
      payload: ArchiveSessionPayload
    ): Promise<IpcResponse> => {
      try {
        // Get the instance from instance manager
        const instance = instanceManager.getInstance(payload.instanceId);
        if (!instance) {
          throw new Error(`Instance not found: ${payload.instanceId}`);
        }
        const meta = archiveManager.archiveSession(instance, payload.tags);
        return { success: true, data: meta };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ARCHIVE_SESSION_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // List archives
  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_LIST,
    async (
      event: IpcMainInvokeEvent,
      payload: ArchiveListPayload
    ): Promise<IpcResponse> => {
      try {
        const filter = payload
          ? {
              beforeDate: payload.beforeDate,
              afterDate: payload.afterDate,
              tags: payload.tags,
              searchTerm: payload.searchTerm
            }
          : undefined;
        const archives = archiveManager.listArchivedSessions(filter);
        return { success: true, data: archives };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ARCHIVE_LIST_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Restore archive
  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_RESTORE,
    async (
      event: IpcMainInvokeEvent,
      payload: ArchiveRestorePayload
    ): Promise<IpcResponse> => {
      try {
        const sessionData = archiveManager.restoreSession(payload.sessionId);
        return { success: true, data: sessionData };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ARCHIVE_RESTORE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Delete archive
  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_DELETE,
    async (
      event: IpcMainInvokeEvent,
      payload: ArchiveDeletePayload
    ): Promise<IpcResponse> => {
      try {
        const success = archiveManager.deleteArchivedSession(
          payload.sessionId
        );
        return { success: true, data: { deleted: success } };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ARCHIVE_DELETE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get archive metadata
  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_GET_META,
    async (
      event: IpcMainInvokeEvent,
      payload: ArchiveGetMetaPayload
    ): Promise<IpcResponse> => {
      try {
        const meta = archiveManager.getArchivedSessionMeta(payload.sessionId);
        return { success: true, data: meta };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ARCHIVE_GET_META_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Update tags
  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_UPDATE_TAGS,
    async (
      event: IpcMainInvokeEvent,
      payload: ArchiveUpdateTagsPayload
    ): Promise<IpcResponse> => {
      try {
        const success = archiveManager.updateTags(
          payload.sessionId,
          payload.tags
        );
        return { success: true, data: { updated: success } };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ARCHIVE_UPDATE_TAGS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get archive stats
  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_GET_STATS,
    async (): Promise<IpcResponse> => {
      try {
        const stats = archiveManager.getArchiveStats();
        return { success: true, data: stats };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ARCHIVE_GET_STATS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Cleanup old archives
  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_CLEANUP,
    async (
      event: IpcMainInvokeEvent,
      payload: ArchiveCleanupPayload
    ): Promise<IpcResponse> => {
      try {
        const deleted = archiveManager.cleanupOldArchives(payload.maxAgeDays);
        return { success: true, data: { deletedCount: deleted } };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ARCHIVE_CLEANUP_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // ============================================
  // History Handlers
  // ============================================

  const history = getHistoryManager();

  // List history entries
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_LIST,
    async (
      event: IpcMainInvokeEvent,
      payload: HistoryListPayload
    ): Promise<IpcResponse> => {
      try {
        const entries = history.getEntries(payload);
        return {
          success: true,
          data: entries
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'HISTORY_LIST_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Load full conversation data
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_LOAD,
    async (
      event: IpcMainInvokeEvent,
      payload: HistoryLoadPayload
    ): Promise<IpcResponse> => {
      try {
        const data = await history.loadConversation(payload.entryId);
        if (!data) {
          return {
            success: false,
            error: {
              code: 'HISTORY_NOT_FOUND',
              message: `History entry ${payload.entryId} not found`,
              timestamp: Date.now()
            }
          };
        }
        return {
          success: true,
          data
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'HISTORY_LOAD_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Delete history entry
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_DELETE,
    async (
      event: IpcMainInvokeEvent,
      payload: HistoryDeletePayload
    ): Promise<IpcResponse> => {
      try {
        const deleted = await history.deleteEntry(payload.entryId);
        return {
          success: deleted,
          error: deleted
            ? undefined
            : {
                code: 'HISTORY_NOT_FOUND',
                message: `History entry ${payload.entryId} not found`,
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'HISTORY_DELETE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Restore conversation as new instance
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_RESTORE,
    async (
      event: IpcMainInvokeEvent,
      payload: HistoryRestorePayload
    ): Promise<IpcResponse> => {
      try {
        const data = await history.loadConversation(payload.entryId);
        if (!data) {
          return {
            success: false,
            error: {
              code: 'HISTORY_NOT_FOUND',
              message: `History entry ${payload.entryId} not found`,
              timestamp: Date.now()
            }
          };
        }

        // Create a new instance that resumes the previous session
        // This allows Claude to have full context of the previous conversation
        const instance = await instanceManager.createInstance({
          workingDirectory:
            payload.workingDirectory || data.entry.workingDirectory,
          displayName: `${data.entry.displayName} (restored)`,
          sessionId: data.entry.sessionId, // Use the original session ID
          resume: true, // Resume the session to restore Claude's context
          initialOutputBuffer: data.messages // Pre-populate output buffer for display
        });

        return {
          success: true,
          data: {
            instanceId: instance.id,
            restoredMessages: data.messages
          }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'HISTORY_RESTORE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Clear all history
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_CLEAR,
    async (): Promise<IpcResponse> => {
      try {
        await history.clearAll();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'HISTORY_CLEAR_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
