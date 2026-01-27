/**
 * Search IPC Service - Semantic search operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class SearchIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // Semantic Search
  // ============================================

  /**
   * Perform semantic search
   */
  async searchSemantic(options: {
    query: string;
    directory: string;
    maxResults?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
    searchType?: 'semantic' | 'hybrid' | 'keyword';
    minScore?: number;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.searchSemantic(options);
  }

  /**
   * Build search index
   */
  async searchBuildIndex(
    directory: string,
    includePatterns?: string[],
    excludePatterns?: string[]
  ): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.searchBuildIndex(directory, includePatterns, excludePatterns);
  }

  /**
   * Configure Exa API for enhanced search
   */
  async searchConfigureExa(config: { apiKey: string; baseUrl?: string }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.searchConfigureExa(config);
  }

  /**
   * Get search index stats
   */
  async searchGetIndexStats(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.searchGetIndexStats();
  }
}
