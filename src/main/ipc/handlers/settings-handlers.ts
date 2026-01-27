/**
 * Settings IPC Handlers
 * Handles settings, config, and remote config related IPC communication
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  SettingsSetPayload,
  SettingsUpdatePayload,
  SettingsResetOnePayload,
  ConfigResolvePayload,
  ConfigGetProjectPayload,
  ConfigSaveProjectPayload,
  ConfigCreateProjectPayload,
  ConfigFindProjectPayload,
  RemoteConfigFetchUrlPayload,
  RemoteConfigFetchWellKnownPayload,
  RemoteConfigFetchGitHubPayload,
  RemoteConfigDiscoverGitPayload,
  RemoteConfigInvalidatePayload
} from '../../../shared/types/ipc.types';
import type { AppSettings, ProjectConfig } from '../../../shared/types/settings.types';
import { getSettingsManager } from '../../core/config/settings-manager';
import {
  resolveConfig,
  loadProjectConfig,
  saveProjectConfig,
  createProjectConfig,
  findProjectConfigPath
} from '../../core/config/config-resolver';
import { getRemoteConfigManager } from '../../core/config/remote-config';
import { WindowManager } from '../../window-manager';

interface SettingsHandlerDeps {
  windowManager: WindowManager;
}

export function registerSettingsHandlers(deps: SettingsHandlerDeps): void {
  const settings = getSettingsManager();
  const remoteConfigManager = getRemoteConfigManager();

  // ============================================
  // Settings Handlers
  // ============================================

  // Get all settings
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET_ALL,
    async (): Promise<IpcResponse> => {
      try {
        return {
          success: true,
          data: settings.getAll()
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SETTINGS_GET_ALL_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get single setting
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    async (event: IpcMainInvokeEvent, key: string): Promise<IpcResponse> => {
      try {
        return {
          success: true,
          data: settings.get(key as keyof AppSettings)
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SETTINGS_GET_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Set single setting
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    async (
      event: IpcMainInvokeEvent,
      payload: SettingsSetPayload
    ): Promise<IpcResponse> => {
      try {
        settings.set(payload.key as keyof AppSettings, payload.value as any);
        // Notify renderer of change
        deps.windowManager
          .getMainWindow()
          ?.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, {
            key: payload.key,
            value: payload.value
          });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SETTINGS_SET_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Update multiple settings
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_UPDATE,
    async (
      event: IpcMainInvokeEvent,
      payload: SettingsUpdatePayload
    ): Promise<IpcResponse> => {
      try {
        settings.update(payload.settings as Partial<AppSettings>);
        // Notify renderer of changes
        deps.windowManager
          .getMainWindow()
          ?.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, {
            settings: settings.getAll()
          });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SETTINGS_UPDATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Reset all settings
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_RESET,
    async (): Promise<IpcResponse> => {
      try {
        settings.reset();
        // Notify renderer
        deps.windowManager
          .getMainWindow()
          ?.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, {
            settings: settings.getAll()
          });
        return {
          success: true,
          data: settings.getAll()
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SETTINGS_RESET_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Reset single setting
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_RESET_ONE,
    async (
      event: IpcMainInvokeEvent,
      payload: SettingsResetOnePayload
    ): Promise<IpcResponse> => {
      try {
        settings.resetOne(payload.key as keyof AppSettings);
        const value = settings.get(payload.key as keyof AppSettings);
        // Notify renderer
        deps.windowManager
          .getMainWindow()
          ?.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, {
            key: payload.key,
            value
          });
        return {
          success: true,
          data: value
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SETTINGS_RESET_ONE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // ============================================
  // Config Handlers
  // ============================================

  // Resolve configuration for a working directory
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_RESOLVE,
    async (
      event: IpcMainInvokeEvent,
      payload: ConfigResolvePayload
    ): Promise<IpcResponse> => {
      try {
        const resolved = resolveConfig(payload.workingDirectory);
        return {
          success: true,
          data: resolved
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'CONFIG_RESOLVE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get project config from a specific path
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_PROJECT,
    async (
      event: IpcMainInvokeEvent,
      payload: ConfigGetProjectPayload
    ): Promise<IpcResponse> => {
      try {
        const config = loadProjectConfig(payload.configPath);
        if (!config) {
          return {
            success: false,
            error: {
              code: 'CONFIG_NOT_FOUND',
              message: `Project config not found at ${payload.configPath}`,
              timestamp: Date.now()
            }
          };
        }
        return {
          success: true,
          data: config
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'CONFIG_GET_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Save project config
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_PROJECT,
    async (
      event: IpcMainInvokeEvent,
      payload: ConfigSaveProjectPayload
    ): Promise<IpcResponse> => {
      try {
        const saved = saveProjectConfig(
          payload.configPath,
          payload.config as ProjectConfig
        );
        return {
          success: saved,
          error: saved
            ? undefined
            : {
                code: 'CONFIG_SAVE_FAILED',
                message: `Failed to save project config to ${payload.configPath}`,
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'CONFIG_SAVE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Create new project config
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_CREATE_PROJECT,
    async (
      event: IpcMainInvokeEvent,
      payload: ConfigCreateProjectPayload
    ): Promise<IpcResponse> => {
      try {
        const configPath = createProjectConfig(
          payload.projectDir,
          payload.config as Partial<ProjectConfig>
        );
        return {
          success: true,
          data: { configPath }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'CONFIG_CREATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Find project config path
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_FIND_PROJECT,
    async (
      event: IpcMainInvokeEvent,
      payload: ConfigFindProjectPayload
    ): Promise<IpcResponse> => {
      try {
        const configPath = findProjectConfigPath(payload.startDir);
        return {
          success: true,
          data: { configPath }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'CONFIG_FIND_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // ============================================
  // Remote Config Handlers
  // ============================================

  // Fetch config from URL
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_CONFIG_FETCH_URL,
    async (
      _event: IpcMainInvokeEvent,
      payload: RemoteConfigFetchUrlPayload
    ): Promise<IpcResponse> => {
      try {
        const config = await remoteConfigManager.fetchFromUrl(payload.url, {
          timeout: payload.timeout,
          cacheTTL: payload.cacheTTL,
          maxRetries: payload.maxRetries,
          useCache: payload.useCache
        });
        return { success: true, data: config };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REMOTE_CONFIG_FETCH_URL_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Fetch from well-known endpoint
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_CONFIG_FETCH_WELL_KNOWN,
    async (
      _event: IpcMainInvokeEvent,
      payload: RemoteConfigFetchWellKnownPayload
    ): Promise<IpcResponse> => {
      try {
        const config = await remoteConfigManager.fetchFromWellKnown(
          payload.domain,
          {
            timeout: payload.timeout,
            cacheTTL: payload.cacheTTL
          }
        );
        return { success: true, data: config };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REMOTE_CONFIG_FETCH_WELL_KNOWN_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Fetch from GitHub
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_CONFIG_FETCH_GITHUB,
    async (
      _event: IpcMainInvokeEvent,
      payload: RemoteConfigFetchGitHubPayload
    ): Promise<IpcResponse> => {
      try {
        const config = await remoteConfigManager.fetchFromGitHub(
          payload.owner,
          payload.repo,
          payload.branch
        );
        return { success: true, data: config };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REMOTE_CONFIG_FETCH_GITHUB_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Discover config for git repo
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_CONFIG_DISCOVER_GIT,
    async (
      _event: IpcMainInvokeEvent,
      payload: RemoteConfigDiscoverGitPayload
    ): Promise<IpcResponse> => {
      try {
        const config = await remoteConfigManager.discoverForGitRepo(
          payload.gitRemoteUrl
        );
        return { success: true, data: config };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REMOTE_CONFIG_DISCOVER_GIT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get cached configs
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_CONFIG_GET_CACHED,
    async (): Promise<IpcResponse> => {
      try {
        const cached = remoteConfigManager.getCachedConfigs();
        return { success: true, data: cached };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REMOTE_CONFIG_GET_CACHED_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Clear cache
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_CONFIG_CLEAR_CACHE,
    async (): Promise<IpcResponse> => {
      try {
        remoteConfigManager.clearCache();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REMOTE_CONFIG_CLEAR_CACHE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Invalidate specific cache entry
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_CONFIG_INVALIDATE,
    async (
      _event: IpcMainInvokeEvent,
      payload: RemoteConfigInvalidatePayload
    ): Promise<IpcResponse> => {
      try {
        remoteConfigManager.invalidateCache(payload.url);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REMOTE_CONFIG_INVALIDATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
