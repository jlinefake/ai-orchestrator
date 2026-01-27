/**
 * Hook Approval Module
 *
 * User approval dialogs for hooks.
 */

import { dialog, BrowserWindow } from 'electron';
import type { EventEmitter } from 'events';
import type { EnhancedHookConfig, HookExecutionContext } from './hook-types';

/**
 * Request user approval for a hook.
 */
export function requestApproval(
  hook: EnhancedHookConfig,
  context: HookExecutionContext,
  emitter: EventEmitter
): { approved: boolean; remember: boolean } {
  emitter.emit('hook:approval-required', { hookId: hook.id, hook, context });

  const window =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!window) {
    return { approved: false, remember: false };
  }

  const detailLines = [
    `Hook: ${hook.name}`,
    `Type: ${hook.handler.type}`,
    hook.handler.command ? `Command: ${hook.handler.command}` : undefined,
    hook.handler.scriptPath
      ? `Script: ${hook.handler.scriptPath}`
      : undefined,
    context.toolName ? `Tool: ${context.toolName}` : undefined,
    context.filePath ? `File: ${context.filePath}` : undefined
  ].filter(Boolean);

  const result = dialog.showMessageBoxSync(window, {
    type: 'warning',
    title: 'Approve hook execution',
    message: 'A hook requires approval before it can run.',
    detail: detailLines.join('\n'),
    buttons: ['Approve once', 'Always allow', 'Deny'],
    defaultId: 0,
    cancelId: 2
  });

  if (result === 0) {
    return { approved: true, remember: false };
  }
  if (result === 1) {
    return { approved: true, remember: true };
  }
  return { approved: false, remember: false };
}
