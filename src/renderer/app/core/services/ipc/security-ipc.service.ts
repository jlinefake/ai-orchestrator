/**
 * Security IPC Service - Security, secret detection, and redaction operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class SecurityIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  // ============================================
  // Security - Secret Detection & Redaction
  // ============================================

  /**
   * Detect secrets in content
   */
  async securityDetectSecrets(content: string, contentType?: 'env' | 'text' | 'auto'): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.securityDetectSecrets(content, contentType);
  }

  /**
   * Redact secrets in content
   */
  async securityRedactContent(
    content: string,
    contentType?: 'env' | 'text' | 'auto',
    options?: { maskChar?: string; showStart?: number; showEnd?: number; fullMask?: boolean; label?: string }
  ): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.securityRedactContent(content, contentType, options);
  }

  /**
   * Check if a file path is sensitive
   */
  async securityCheckFile(filePath: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.securityCheckFile(filePath);
  }

  /**
   * Get secret access audit log
   */
  async securityGetAuditLog(instanceId?: string, limit?: number): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.securityGetAuditLog(instanceId, limit);
  }

  /**
   * Clear audit log
   */
  async securityClearAuditLog(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.securityClearAuditLog();
  }

  /**
   * Get safe environment variables
   */
  async securityGetSafeEnv(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.securityGetSafeEnv();
  }

  /**
   * Check if a single env var should be allowed
   */
  async securityCheckEnvVar(name: string, value: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.securityCheckEnvVar(name, value);
  }

  /**
   * Get env filter config
   */
  async securityGetEnvFilterConfig(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.securityGetEnvFilterConfig();
  }
}
