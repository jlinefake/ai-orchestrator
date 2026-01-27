/**
 * Task/Subagent Management IPC Handlers
 * Handles task status, history, and queue operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  TaskGetStatusPayload,
  TaskGetHistoryPayload,
  TaskGetByParentPayload,
  TaskGetByChildPayload,
  TaskCancelPayload
} from '../../../shared/types/ipc.types';
import { getTaskManager } from '../../orchestration/task-manager';

export function registerTaskHandlers(): void {
  const taskManager = getTaskManager();

  // Get task status by ID
  ipcMain.handle(
    IPC_CHANNELS.TASK_GET_STATUS,
    async (
      _event: IpcMainInvokeEvent,
      payload: TaskGetStatusPayload
    ): Promise<IpcResponse> => {
      try {
        const task = taskManager.getTask(payload.taskId);
        return {
          success: true,
          data: task ? taskManager.serializeTask(task) : null
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TASK_GET_STATUS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get task history
  ipcMain.handle(
    IPC_CHANNELS.TASK_GET_HISTORY,
    async (
      _event: IpcMainInvokeEvent,
      payload: TaskGetHistoryPayload
    ): Promise<IpcResponse> => {
      try {
        const history = taskManager.getTaskHistory(payload.parentId);
        return {
          success: true,
          data: history
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TASK_GET_HISTORY_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get tasks by parent instance
  ipcMain.handle(
    IPC_CHANNELS.TASK_GET_BY_PARENT,
    async (
      _event: IpcMainInvokeEvent,
      payload: TaskGetByParentPayload
    ): Promise<IpcResponse> => {
      try {
        const tasks = taskManager.getTasksByParentId(payload.parentId);
        return {
          success: true,
          data: tasks.map((t) => taskManager.serializeTask(t))
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TASK_GET_BY_PARENT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get task by child instance
  ipcMain.handle(
    IPC_CHANNELS.TASK_GET_BY_CHILD,
    async (
      _event: IpcMainInvokeEvent,
      payload: TaskGetByChildPayload
    ): Promise<IpcResponse> => {
      try {
        const task = taskManager.getTaskByChildId(payload.childId);
        return {
          success: true,
          data: task ? taskManager.serializeTask(task) : null
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TASK_GET_BY_CHILD_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Cancel a task
  ipcMain.handle(
    IPC_CHANNELS.TASK_CANCEL,
    async (
      _event: IpcMainInvokeEvent,
      payload: TaskCancelPayload
    ): Promise<IpcResponse> => {
      try {
        const success = taskManager.cancelTask(payload.taskId);
        return {
          success: true,
          data: { cancelled: success }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TASK_CANCEL_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get task queue
  ipcMain.handle(
    IPC_CHANNELS.TASK_GET_QUEUE,
    async (): Promise<IpcResponse> => {
      try {
        const stats = taskManager.getStats();
        return {
          success: true,
          data: stats
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TASK_GET_QUEUE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
