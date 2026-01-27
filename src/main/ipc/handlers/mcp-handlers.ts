/**
 * MCP (Model Context Protocol) IPC Handlers
 * Handles MCP server management and operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  McpServerPayload,
  McpAddServerPayload,
  McpCallToolPayload,
  McpReadResourcePayload,
  McpGetPromptPayload
} from '../../../shared/types/ipc.types';
import { getMcpManager } from '../../mcp/mcp-manager';
import { MCP_SERVER_PRESETS } from '../../../shared/types/mcp.types';
import { WindowManager } from '../../window-manager';

export function registerMcpHandlers(deps: {
  windowManager: WindowManager;
}): void {
  const mcp = getMcpManager();

  // Set up event forwarding to renderer
  mcp.on('server:connected', (serverId) => {
    deps.windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.MCP_SERVER_STATUS_CHANGED, {
        serverId,
        status: 'connected'
      });
  });

  mcp.on('server:disconnected', (serverId) => {
    deps.windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.MCP_SERVER_STATUS_CHANGED, {
        serverId,
        status: 'disconnected'
      });
  });

  mcp.on('server:error', (serverId, error) => {
    deps.windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.MCP_SERVER_STATUS_CHANGED, {
        serverId,
        status: 'error',
        error
      });
  });

  mcp.on('tools:updated', (tools) => {
    deps.windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.MCP_STATE_CHANGED, { type: 'tools' });
  });

  mcp.on('resources:updated', (resources) => {
    deps.windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.MCP_STATE_CHANGED, {
        type: 'resources'
      });
  });

  mcp.on('prompts:updated', (prompts) => {
    deps.windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.MCP_STATE_CHANGED, { type: 'prompts' });
  });

  // Get full MCP state
  ipcMain.handle(
    IPC_CHANNELS.MCP_GET_STATE,
    async (): Promise<IpcResponse> => {
      try {
        const state = mcp.getState();
        return {
          success: true,
          data: state
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_GET_STATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get all servers
  ipcMain.handle(
    IPC_CHANNELS.MCP_GET_SERVERS,
    async (): Promise<IpcResponse> => {
      try {
        const servers = mcp.getServers();
        return {
          success: true,
          data: servers
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_GET_SERVERS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Add a server
  ipcMain.handle(
    IPC_CHANNELS.MCP_ADD_SERVER,
    async (
      event: IpcMainInvokeEvent,
      payload: McpAddServerPayload
    ): Promise<IpcResponse> => {
      try {
        mcp.addServer({
          id: payload.id,
          name: payload.name,
          description: payload.description,
          transport: payload.transport,
          command: payload.command,
          args: payload.args,
          env: payload.env,
          url: payload.url,
          autoConnect: payload.autoConnect
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_ADD_SERVER_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Remove a server
  ipcMain.handle(
    IPC_CHANNELS.MCP_REMOVE_SERVER,
    async (
      event: IpcMainInvokeEvent,
      payload: McpServerPayload
    ): Promise<IpcResponse> => {
      try {
        await mcp.removeServer(payload.serverId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_REMOVE_SERVER_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Connect to a server
  ipcMain.handle(
    IPC_CHANNELS.MCP_CONNECT,
    async (
      event: IpcMainInvokeEvent,
      payload: McpServerPayload
    ): Promise<IpcResponse> => {
      try {
        await mcp.connect(payload.serverId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_CONNECT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Disconnect from a server
  ipcMain.handle(
    IPC_CHANNELS.MCP_DISCONNECT,
    async (
      event: IpcMainInvokeEvent,
      payload: McpServerPayload
    ): Promise<IpcResponse> => {
      try {
        await mcp.disconnect(payload.serverId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_DISCONNECT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Restart a server
  ipcMain.handle(
    IPC_CHANNELS.MCP_RESTART,
    async (
      event: IpcMainInvokeEvent,
      payload: McpServerPayload
    ): Promise<IpcResponse> => {
      try {
        await mcp.restart(payload.serverId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_RESTART_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get tools
  ipcMain.handle(
    IPC_CHANNELS.MCP_GET_TOOLS,
    async (): Promise<IpcResponse> => {
      try {
        const tools = mcp.getTools();
        return {
          success: true,
          data: tools
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_GET_TOOLS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get resources
  ipcMain.handle(
    IPC_CHANNELS.MCP_GET_RESOURCES,
    async (): Promise<IpcResponse> => {
      try {
        const resources = mcp.getResources();
        return {
          success: true,
          data: resources
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_GET_RESOURCES_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get prompts
  ipcMain.handle(
    IPC_CHANNELS.MCP_GET_PROMPTS,
    async (): Promise<IpcResponse> => {
      try {
        const prompts = mcp.getPrompts();
        return {
          success: true,
          data: prompts
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_GET_PROMPTS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Call a tool
  ipcMain.handle(
    IPC_CHANNELS.MCP_CALL_TOOL,
    async (
      event: IpcMainInvokeEvent,
      payload: McpCallToolPayload
    ): Promise<IpcResponse> => {
      try {
        const result = await mcp.callTool({
          serverId: payload.serverId,
          toolName: payload.toolName,
          arguments: payload.arguments
        });
        return {
          success: result.success,
          data: result,
          error: result.success
            ? undefined
            : {
                code: 'MCP_TOOL_CALL_ERROR',
                message: result.error || 'Unknown error',
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_CALL_TOOL_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Read a resource
  ipcMain.handle(
    IPC_CHANNELS.MCP_READ_RESOURCE,
    async (
      event: IpcMainInvokeEvent,
      payload: McpReadResourcePayload
    ): Promise<IpcResponse> => {
      try {
        const result = await mcp.readResource({
          serverId: payload.serverId,
          uri: payload.uri
        });
        return {
          success: result.success,
          data: result,
          error: result.success
            ? undefined
            : {
                code: 'MCP_RESOURCE_READ_ERROR',
                message: result.error || 'Unknown error',
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_READ_RESOURCE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get a prompt
  ipcMain.handle(
    IPC_CHANNELS.MCP_GET_PROMPT,
    async (
      event: IpcMainInvokeEvent,
      payload: McpGetPromptPayload
    ): Promise<IpcResponse> => {
      try {
        const result = await mcp.getPrompt({
          serverId: payload.serverId,
          promptName: payload.promptName,
          arguments: payload.arguments
        });
        return {
          success: result.success,
          data: result,
          error: result.success
            ? undefined
            : {
                code: 'MCP_PROMPT_GET_ERROR',
                message: result.error || 'Unknown error',
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'MCP_GET_PROMPT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get server presets
  ipcMain.handle(
    IPC_CHANNELS.MCP_GET_PRESETS,
    async (): Promise<IpcResponse> => {
      return {
        success: true,
        data: MCP_SERVER_PRESETS
      };
    }
  );
}
