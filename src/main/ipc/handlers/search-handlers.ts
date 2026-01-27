/**
 * Search IPC Handlers
 * Handles semantic search, index building, and Exa configuration
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  SearchSemanticPayload,
  SearchBuildIndexPayload,
  SearchConfigureExaPayload
} from '../../../shared/types/ipc.types';
import { getSemanticSearchManager } from '../../workspace/semantic-search';

export function registerSearchHandlers(): void {
  const searchManager = getSemanticSearchManager();

  // ============================================
  // Search Handlers
  // ============================================

  // Semantic search
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_SEMANTIC,
    async (
      _event: IpcMainInvokeEvent,
      payload: SearchSemanticPayload
    ): Promise<IpcResponse> => {
      try {
        const results = await searchManager.search({
          query: payload.query,
          directory: payload.directory,
          maxResults: payload.maxResults,
          includePatterns: payload.includePatterns,
          excludePatterns: payload.excludePatterns,
          searchType: payload.searchType
        });
        return { success: true, data: results };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SEARCH_SEMANTIC_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Build index
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_BUILD_INDEX,
    async (
      _event: IpcMainInvokeEvent,
      payload: SearchBuildIndexPayload
    ): Promise<IpcResponse> => {
      try {
        await searchManager.buildIndex(
          payload.directory,
          payload.includePatterns || ['**/*.ts', '**/*.js', '**/*.py'],
          payload.excludePatterns || ['**/node_modules/**', '**/.git/**']
        );
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SEARCH_BUILD_INDEX_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Configure Exa
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_CONFIGURE_EXA,
    async (
      _event: IpcMainInvokeEvent,
      payload: SearchConfigureExaPayload
    ): Promise<IpcResponse> => {
      try {
        searchManager.configureExa({
          apiKey: payload.apiKey,
          baseUrl: payload.baseUrl
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SEARCH_CONFIGURE_EXA_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Clear index
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_CLEAR_INDEX,
    async (): Promise<IpcResponse> => {
      try {
        searchManager.clearIndex();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SEARCH_CLEAR_INDEX_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get index stats
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_GET_INDEX_STATS,
    async (): Promise<IpcResponse> => {
      try {
        const stats = searchManager.getIndexStats();
        return { success: true, data: stats };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SEARCH_GET_INDEX_STATS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Check if Exa is configured
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_IS_EXA_CONFIGURED,
    async (): Promise<IpcResponse> => {
      try {
        const isConfigured = searchManager.isExaConfigured();
        return { success: true, data: isConfigured };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SEARCH_IS_EXA_CONFIGURED_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
