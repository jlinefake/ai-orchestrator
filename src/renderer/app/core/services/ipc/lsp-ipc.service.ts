/**
 * LSP IPC Service - Language Server Protocol operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class LspIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // LSP Operations
  // ============================================

  /**
   * Get available LSP servers (installed language servers)
   */
  async lspGetAvailableServers(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspGetAvailableServers();
  }

  /**
   * Get status of all active LSP clients
   */
  async lspGetStatus(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspGetStatus();
  }

  /**
   * Go to definition (navigate to where symbol is defined)
   */
  async lspGoToDefinition(filePath: string, line: number, character: number): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspGoToDefinition({ filePath, line, character });
  }

  /**
   * Find all references to a symbol
   */
  async lspFindReferences(filePath: string, line: number, character: number, includeDeclaration = true): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspFindReferences({ filePath, line, character, includeDeclaration });
  }

  /**
   * Get hover information (type info, documentation)
   */
  async lspHover(filePath: string, line: number, character: number): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspHover({ filePath, line, character });
  }

  /**
   * Get document symbols (outline/structure)
   */
  async lspDocumentSymbols(filePath: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspDocumentSymbols(filePath);
  }

  /**
   * Search workspace symbols
   */
  async lspWorkspaceSymbols(query: string, rootPath: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspWorkspaceSymbols(query, rootPath);
  }

  /**
   * Get diagnostics (errors, warnings) for a file
   */
  async lspDiagnostics(filePath: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspDiagnostics(filePath);
  }

  /**
   * Check if LSP is available for a file type
   */
  async lspIsAvailable(filePath: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspIsAvailable(filePath);
  }

  /**
   * Shutdown all LSP clients
   */
  async lspShutdown(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.lspShutdown();
  }
}
