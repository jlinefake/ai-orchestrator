/**
 * Command IPC Handlers
 * Handles command management and plan mode functionality
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  CommandExecutePayload,
  CommandCreatePayload,
  CommandUpdatePayload,
  CommandDeletePayload,
  PlanModeEnterPayload,
  PlanModeExitPayload,
  PlanModeApprovePayload,
  PlanModeUpdatePayload,
  PlanModeGetStatePayload
} from '../../../shared/types/ipc.types';
import { getCommandManager } from '../../commands/command-manager';
import { InstanceManager } from '../../instance/instance-manager';

export function registerCommandHandlers(
  instanceManager: InstanceManager
): void {
  const commands = getCommandManager();

  // ============================================
  // Command Handlers
  // ============================================

  // List all commands
  ipcMain.handle(
    IPC_CHANNELS.COMMAND_LIST,
    async (): Promise<IpcResponse> => {
      try {
        const allCommands = commands.getAllCommands();
        return {
          success: true,
          data: allCommands
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'COMMAND_LIST_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Execute command
  ipcMain.handle(
    IPC_CHANNELS.COMMAND_EXECUTE,
    async (
      event: IpcMainInvokeEvent,
      payload: CommandExecutePayload
    ): Promise<IpcResponse> => {
      try {
        const resolved = commands.executeCommand(
          payload.commandId,
          payload.args || []
        );
        if (!resolved) {
          return {
            success: false,
            error: {
              code: 'COMMAND_NOT_FOUND',
              message: `Command ${payload.commandId} not found`,
              timestamp: Date.now()
            }
          };
        }

        // Send the resolved prompt to the instance
        await instanceManager.sendInput(
          payload.instanceId,
          resolved.resolvedPrompt
        );

        return {
          success: true,
          data: resolved
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'COMMAND_EXECUTE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Create custom command
  ipcMain.handle(
    IPC_CHANNELS.COMMAND_CREATE,
    async (
      event: IpcMainInvokeEvent,
      payload: CommandCreatePayload
    ): Promise<IpcResponse> => {
      try {
        const command = commands.createCommand(payload);
        return {
          success: true,
          data: command
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'COMMAND_CREATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Update custom command
  ipcMain.handle(
    IPC_CHANNELS.COMMAND_UPDATE,
    async (
      event: IpcMainInvokeEvent,
      payload: CommandUpdatePayload
    ): Promise<IpcResponse> => {
      try {
        const updated = commands.updateCommand(
          payload.commandId,
          payload.updates
        );
        if (!updated) {
          return {
            success: false,
            error: {
              code: 'COMMAND_NOT_FOUND',
              message: `Command ${payload.commandId} not found or is built-in`,
              timestamp: Date.now()
            }
          };
        }
        return {
          success: true,
          data: updated
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'COMMAND_UPDATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Delete custom command
  ipcMain.handle(
    IPC_CHANNELS.COMMAND_DELETE,
    async (
      event: IpcMainInvokeEvent,
      payload: CommandDeletePayload
    ): Promise<IpcResponse> => {
      try {
        const deleted = commands.deleteCommand(payload.commandId);
        return {
          success: deleted,
          error: deleted
            ? undefined
            : {
                code: 'COMMAND_NOT_FOUND',
                message: `Command ${payload.commandId} not found or is built-in`,
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'COMMAND_DELETE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // ============================================
  // Plan Mode Handlers
  // ============================================

  // Enter plan mode
  ipcMain.handle(
    IPC_CHANNELS.PLAN_MODE_ENTER,
    async (
      event: IpcMainInvokeEvent,
      payload: PlanModeEnterPayload
    ): Promise<IpcResponse> => {
      try {
        const instance = instanceManager.enterPlanMode(payload.instanceId);
        return {
          success: true,
          data: { planMode: instance.planMode }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'PLAN_MODE_ENTER_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Exit plan mode
  ipcMain.handle(
    IPC_CHANNELS.PLAN_MODE_EXIT,
    async (
      event: IpcMainInvokeEvent,
      payload: PlanModeExitPayload
    ): Promise<IpcResponse> => {
      try {
        const instance = instanceManager.exitPlanMode(
          payload.instanceId,
          payload.force
        );
        return {
          success: true,
          data: { planMode: instance.planMode }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'PLAN_MODE_EXIT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Approve plan
  ipcMain.handle(
    IPC_CHANNELS.PLAN_MODE_APPROVE,
    async (
      event: IpcMainInvokeEvent,
      payload: PlanModeApprovePayload
    ): Promise<IpcResponse> => {
      try {
        const instance = instanceManager.approvePlan(
          payload.instanceId,
          payload.planContent
        );
        return {
          success: true,
          data: { planMode: instance.planMode }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'PLAN_MODE_APPROVE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Update plan content
  ipcMain.handle(
    IPC_CHANNELS.PLAN_MODE_UPDATE,
    async (
      event: IpcMainInvokeEvent,
      payload: PlanModeUpdatePayload
    ): Promise<IpcResponse> => {
      try {
        const instance = instanceManager.updatePlanContent(
          payload.instanceId,
          payload.planContent
        );
        return {
          success: true,
          data: { planMode: instance.planMode }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'PLAN_MODE_UPDATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get plan mode state
  ipcMain.handle(
    IPC_CHANNELS.PLAN_MODE_GET_STATE,
    async (
      event: IpcMainInvokeEvent,
      payload: PlanModeGetStatePayload
    ): Promise<IpcResponse> => {
      try {
        const state = instanceManager.getPlanModeState(payload.instanceId);
        return {
          success: true,
          data: state
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'PLAN_MODE_GET_STATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
