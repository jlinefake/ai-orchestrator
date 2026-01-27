/**
 * LSP IPC Handlers
 * Handles Language Server Protocol operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  LspPositionPayload,
  LspFindReferencesPayload,
  LspFilePayload,
  LspWorkspaceSymbolPayload
} from '../../../shared/types/ipc.types';
import { getLspManager } from '../../workspace/lsp-manager';

export function registerLspHandlers(): void {
  const lsp = getLspManager();

  // Get available LSP servers
  ipcMain.handle(
    IPC_CHANNELS.LSP_GET_AVAILABLE_SERVERS,
    async (): Promise<IpcResponse> => {
      try {
        const servers = lsp.getAvailableServers();
        return {
          success: true,
          data: servers
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_GET_AVAILABLE_SERVERS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get LSP client status
  ipcMain.handle(
    IPC_CHANNELS.LSP_GET_STATUS,
    async (): Promise<IpcResponse> => {
      try {
        const status = lsp.getStatus();
        return {
          success: true,
          data: status
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_GET_STATUS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Go to definition
  ipcMain.handle(
    IPC_CHANNELS.LSP_GO_TO_DEFINITION,
    async (
      event: IpcMainInvokeEvent,
      payload: LspPositionPayload
    ): Promise<IpcResponse> => {
      try {
        const locations = await lsp.goToDefinition(
          payload.filePath,
          payload.line,
          payload.character
        );
        return {
          success: true,
          data: locations
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_GO_TO_DEFINITION_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Find references
  ipcMain.handle(
    IPC_CHANNELS.LSP_FIND_REFERENCES,
    async (
      event: IpcMainInvokeEvent,
      payload: LspFindReferencesPayload
    ): Promise<IpcResponse> => {
      try {
        const locations = await lsp.findReferences(
          payload.filePath,
          payload.line,
          payload.character,
          payload.includeDeclaration ?? true
        );
        return {
          success: true,
          data: locations
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_FIND_REFERENCES_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Hover
  ipcMain.handle(
    IPC_CHANNELS.LSP_HOVER,
    async (
      event: IpcMainInvokeEvent,
      payload: LspPositionPayload
    ): Promise<IpcResponse> => {
      try {
        const hover = await lsp.hover(
          payload.filePath,
          payload.line,
          payload.character
        );
        return {
          success: true,
          data: hover
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_HOVER_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Document symbols
  ipcMain.handle(
    IPC_CHANNELS.LSP_DOCUMENT_SYMBOLS,
    async (
      event: IpcMainInvokeEvent,
      payload: LspFilePayload
    ): Promise<IpcResponse> => {
      try {
        const symbols = await lsp.getDocumentSymbols(payload.filePath);
        return {
          success: true,
          data: symbols
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_DOCUMENT_SYMBOLS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Workspace symbols
  ipcMain.handle(
    IPC_CHANNELS.LSP_WORKSPACE_SYMBOLS,
    async (
      event: IpcMainInvokeEvent,
      payload: LspWorkspaceSymbolPayload
    ): Promise<IpcResponse> => {
      try {
        const symbols = await lsp.workspaceSymbol(
          payload.query,
          payload.rootPath
        );
        return {
          success: true,
          data: symbols
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_WORKSPACE_SYMBOLS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Diagnostics
  ipcMain.handle(
    IPC_CHANNELS.LSP_DIAGNOSTICS,
    async (
      event: IpcMainInvokeEvent,
      payload: LspFilePayload
    ): Promise<IpcResponse> => {
      try {
        const diagnostics = await lsp.getDiagnostics(payload.filePath);
        return {
          success: true,
          data: diagnostics
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_DIAGNOSTICS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Check if LSP is available for a file
  ipcMain.handle(
    IPC_CHANNELS.LSP_IS_AVAILABLE,
    async (
      event: IpcMainInvokeEvent,
      payload: LspFilePayload
    ): Promise<IpcResponse> => {
      try {
        const available = lsp.isAvailableForFile(payload.filePath);
        return {
          success: true,
          data: { available }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_IS_AVAILABLE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Shutdown all LSP clients
  ipcMain.handle(
    IPC_CHANNELS.LSP_SHUTDOWN,
    async (): Promise<IpcResponse> => {
      try {
        await lsp.shutdown();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LSP_SHUTDOWN_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
