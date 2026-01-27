/**
 * TODO IPC Handlers
 * Handles TODO list management for instances
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  TodoGetListPayload,
  TodoCreatePayload,
  TodoUpdatePayload,
  TodoDeletePayload,
  TodoWriteAllPayload,
  TodoClearPayload,
  TodoGetCurrentPayload
} from '../../../shared/types/ipc.types';
import { getTodoManager } from '../../tasks/todo-manager';
import type { WindowManager } from '../../window-manager';

export function registerTodoHandlers(deps: {
  windowManager: WindowManager;
}): void {
  const todos = getTodoManager();

  // Set up event forwarding to renderer
  todos.on('todos:changed', (sessionId, list) => {
    deps.windowManager
      .getMainWindow()
      ?.webContents.send(IPC_CHANNELS.TODO_LIST_CHANGED, { sessionId, list });
  });

  // Get TODO list for a session
  ipcMain.handle(
    IPC_CHANNELS.TODO_GET_LIST,
    async (
      event: IpcMainInvokeEvent,
      payload: TodoGetListPayload
    ): Promise<IpcResponse> => {
      try {
        const list = todos.getTodoList(payload.sessionId);
        return {
          success: true,
          data: list
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TODO_GET_LIST_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Create a TODO
  ipcMain.handle(
    IPC_CHANNELS.TODO_CREATE,
    async (
      event: IpcMainInvokeEvent,
      payload: TodoCreatePayload
    ): Promise<IpcResponse> => {
      try {
        const item = todos.createTodo(payload.sessionId, {
          content: payload.content,
          activeForm: payload.activeForm,
          priority: payload.priority,
          parentId: payload.parentId
        });
        return {
          success: true,
          data: item
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TODO_CREATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Update a TODO
  ipcMain.handle(
    IPC_CHANNELS.TODO_UPDATE,
    async (
      event: IpcMainInvokeEvent,
      payload: TodoUpdatePayload
    ): Promise<IpcResponse> => {
      try {
        const item = todos.updateTodo(payload.sessionId, {
          id: payload.todoId,
          content: payload.content,
          activeForm: payload.activeForm,
          status: payload.status,
          priority: payload.priority
        });
        if (!item) {
          return {
            success: false,
            error: {
              code: 'TODO_NOT_FOUND',
              message: `TODO ${payload.todoId} not found`,
              timestamp: Date.now()
            }
          };
        }
        return {
          success: true,
          data: item
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TODO_UPDATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Delete a TODO
  ipcMain.handle(
    IPC_CHANNELS.TODO_DELETE,
    async (
      event: IpcMainInvokeEvent,
      payload: TodoDeletePayload
    ): Promise<IpcResponse> => {
      try {
        const deleted = todos.deleteTodo(payload.sessionId, payload.todoId);
        return {
          success: deleted,
          error: deleted
            ? undefined
            : {
                code: 'TODO_NOT_FOUND',
                message: `TODO ${payload.todoId} not found`,
                timestamp: Date.now()
              }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TODO_DELETE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Write all TODOs (replaces existing - matches Claude's TodoWrite format)
  ipcMain.handle(
    IPC_CHANNELS.TODO_WRITE_ALL,
    async (
      event: IpcMainInvokeEvent,
      payload: TodoWriteAllPayload
    ): Promise<IpcResponse> => {
      try {
        const list = todos.writeTodos(payload.sessionId, payload.todos);
        return {
          success: true,
          data: list
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TODO_WRITE_ALL_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Clear all TODOs for a session
  ipcMain.handle(
    IPC_CHANNELS.TODO_CLEAR,
    async (
      event: IpcMainInvokeEvent,
      payload: TodoClearPayload
    ): Promise<IpcResponse> => {
      try {
        todos.clearTodos(payload.sessionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TODO_CLEAR_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get the current in-progress TODO
  ipcMain.handle(
    IPC_CHANNELS.TODO_GET_CURRENT,
    async (
      event: IpcMainInvokeEvent,
      payload: TodoGetCurrentPayload
    ): Promise<IpcResponse> => {
      try {
        const current = todos.getCurrentTodo(payload.sessionId);
        return {
          success: true,
          data: current || null
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TODO_GET_CURRENT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
