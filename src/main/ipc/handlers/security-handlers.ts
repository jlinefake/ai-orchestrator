/**
 * Security IPC Handlers
 * Handles secret detection, redaction, bash validation, and env filtering
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  SecurityDetectSecretsPayload,
  SecurityRedactContentPayload,
  SecurityCheckFilePayload,
  SecurityGetAuditLogPayload,
  SecurityCheckEnvVarPayload
} from '../../../shared/types/ipc.types';
import {
  detectSecretsInContent,
  detectSecretsInEnvContent,
  isSecretFile,
  getFileSensitivity
} from '../../security/secret-detector';
import {
  redactEnvContent,
  redactAllSecrets,
  getSecretAuditLog
} from '../../security/secret-redaction';
import {
  getSafeEnv,
  shouldAllowEnvVar,
  DEFAULT_ENV_FILTER_CONFIG
} from '../../security/env-filter';
import { getBashValidator } from '../../security/bash-validator';

export function registerSecurityHandlers(): void {
  // ============================================
  // Secret Detection & Redaction Handlers
  // ============================================

  // Detect secrets in content
  ipcMain.handle(
    IPC_CHANNELS.SECURITY_DETECT_SECRETS,
    async (
      _event: IpcMainInvokeEvent,
      payload: SecurityDetectSecretsPayload
    ): Promise<IpcResponse> => {
      try {
        let secrets;
        if (payload.contentType === 'env') {
          secrets = detectSecretsInEnvContent(payload.content);
        } else if (payload.contentType === 'text') {
          secrets = detectSecretsInContent(payload.content);
        } else {
          // Auto-detect: if content looks like .env format, use env parser
          const looksLikeEnv = payload.content
            .split('\n')
            .some((line) => /^[A-Z_][A-Z0-9_]*=/.test(line.trim()));
          secrets = looksLikeEnv
            ? detectSecretsInEnvContent(payload.content)
            : detectSecretsInContent(payload.content);
        }
        return {
          success: true,
          data: secrets
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_DETECT_SECRETS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Redact secrets in content
  ipcMain.handle(
    IPC_CHANNELS.SECURITY_REDACT_CONTENT,
    async (
      _event: IpcMainInvokeEvent,
      payload: SecurityRedactContentPayload
    ): Promise<IpcResponse> => {
      try {
        let redacted;
        if (payload.contentType === 'env') {
          redacted = redactEnvContent(payload.content, payload.options);
        } else {
          redacted = redactAllSecrets(payload.content, payload.options);
        }
        return {
          success: true,
          data: { redacted }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_REDACT_CONTENT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Check if a file path is sensitive
  ipcMain.handle(
    IPC_CHANNELS.SECURITY_CHECK_FILE,
    async (
      _event: IpcMainInvokeEvent,
      payload: SecurityCheckFilePayload
    ): Promise<IpcResponse> => {
      try {
        return {
          success: true,
          data: {
            isSecretFile: isSecretFile(payload.filePath),
            sensitivity: getFileSensitivity(payload.filePath)
          }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_CHECK_FILE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get secret access audit log
  ipcMain.handle(
    IPC_CHANNELS.SECURITY_GET_AUDIT_LOG,
    async (
      _event: IpcMainInvokeEvent,
      payload: SecurityGetAuditLogPayload
    ): Promise<IpcResponse> => {
      try {
        const auditLog = getSecretAuditLog();
        const records = payload.instanceId
          ? auditLog.getRecordsByInstance(payload.instanceId, payload.limit)
          : auditLog.getRecords(payload.limit);
        return {
          success: true,
          data: records
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_GET_AUDIT_LOG_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Clear audit log
  ipcMain.handle(
    IPC_CHANNELS.SECURITY_CLEAR_AUDIT_LOG,
    async (): Promise<IpcResponse> => {
      try {
        const auditLog = getSecretAuditLog();
        auditLog.clear();
        return {
          success: true,
          data: { cleared: true }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_CLEAR_AUDIT_LOG_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // ============================================
  // Environment Variable Filtering Handlers
  // ============================================

  // Get safe environment variables
  ipcMain.handle(
    IPC_CHANNELS.SECURITY_GET_SAFE_ENV,
    async (): Promise<IpcResponse> => {
      try {
        const safeEnv = getSafeEnv();
        return {
          success: true,
          data: safeEnv
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_GET_SAFE_ENV_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Check if a single env var should be allowed
  ipcMain.handle(
    IPC_CHANNELS.SECURITY_CHECK_ENV_VAR,
    async (
      _event: IpcMainInvokeEvent,
      payload: SecurityCheckEnvVarPayload
    ): Promise<IpcResponse> => {
      try {
        const result = shouldAllowEnvVar(payload.name, payload.value);
        return {
          success: true,
          data: result
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_CHECK_ENV_VAR_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get env filter config
  ipcMain.handle(
    IPC_CHANNELS.SECURITY_GET_ENV_FILTER_CONFIG,
    async (): Promise<IpcResponse> => {
      try {
        // Serialize config (convert RegExp to strings)
        const config = {
          ...DEFAULT_ENV_FILTER_CONFIG,
          blockPatterns: DEFAULT_ENV_FILTER_CONFIG.blockPatterns.map(
            (p) => p.source
          ),
          allowPatterns: DEFAULT_ENV_FILTER_CONFIG.allowPatterns.map(
            (p) => p.source
          )
        };
        return {
          success: true,
          data: config
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_GET_ENV_FILTER_CONFIG_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // ============================================
  // Bash Validation Handlers
  // ============================================

  const bashValidator = getBashValidator();

  // Validate a bash command
  ipcMain.handle(
    IPC_CHANNELS.BASH_VALIDATE,
    async (
      _event: IpcMainInvokeEvent,
      command: string
    ): Promise<IpcResponse> => {
      try {
        const result = bashValidator.validate(command);
        return {
          success: true,
          data: result
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'BASH_VALIDATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get bash validator config
  ipcMain.handle(
    IPC_CHANNELS.BASH_GET_CONFIG,
    async (): Promise<IpcResponse> => {
      try {
        const config = bashValidator.getConfig();
        // Serialize RegExp patterns to strings for IPC
        const serializedConfig = {
          ...config,
          warningPatterns: config.warningPatterns.map((p) =>
            p instanceof RegExp ? p.source : p
          ),
          blockedPatterns: config.blockedPatterns.map((p) =>
            p instanceof RegExp ? p.source : p
          )
        };
        return {
          success: true,
          data: serializedConfig
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'BASH_GET_CONFIG_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Add an allowed command
  ipcMain.handle(
    IPC_CHANNELS.BASH_ADD_ALLOWED,
    async (
      _event: IpcMainInvokeEvent,
      command: string
    ): Promise<IpcResponse> => {
      try {
        bashValidator.addAllowedCommand(command);
        return {
          success: true,
          data: { command, added: true }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'BASH_ADD_ALLOWED_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Add a blocked command
  ipcMain.handle(
    IPC_CHANNELS.BASH_ADD_BLOCKED,
    async (
      _event: IpcMainInvokeEvent,
      command: string
    ): Promise<IpcResponse> => {
      try {
        bashValidator.addBlockedCommand(command);
        return {
          success: true,
          data: { command, added: true }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'BASH_ADD_BLOCKED_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
